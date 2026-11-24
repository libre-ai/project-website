//! Parsing of a waitlist form (ADR 0006 §3-5), port of `server/subscription.ts`. The form is
//! closed: an unknown field, an unknown value or a repeated single field refuses the request.
//! The honeypot is checked first and reported apart, because the server answers it as a success
//! without storing anything.

use crate::email::normalize_email;
use crate::policy::Policy;
use crate::web::utf16_order;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubscriptionRequest {
    pub email: String,
    /// Distinct, in JavaScript sort order.
    pub universes: Vec<String>,
    /// Reference of the application the visitor wants to hear about, e.g. "P07".
    pub follow: Option<String>,
    pub tester: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Refusal {
    Email,
    Honeypot,
    Field,
}

impl Refusal {
    pub fn code(self) -> &'static str {
        match self {
            Self::Email => "email",
            Self::Honeypot => "honeypot",
            Self::Field => "field",
        }
    }
}

const SINGLE_FIELDS: [&str; 4] = ["courriel", "suivre", "testeur", "site"];
const MULTIPLE_FIELDS: [&str; 1] = ["univers"];

/// Values grouped by name, names in the order they first appear (a JavaScript `Map`).
fn group(entries: &[(String, String)]) -> Vec<(&str, Vec<&str>)> {
    let mut values: Vec<(&str, Vec<&str>)> = Vec::new();
    for (name, value) in entries {
        match values.iter_mut().find(|(known, _)| known == name) {
            Some((_, list)) => list.push(value),
            None => values.push((name, vec![value])),
        }
    }
    values
}

fn first<'a>(values: &[(&str, Vec<&'a str>)], name: &str) -> Option<&'a str> {
    values
        .iter()
        .find(|(known, _)| *known == name)
        .and_then(|(_, list)| list.first().copied())
}

pub fn parse_subscription(
    entries: &[(String, String)],
    policy: &Policy,
) -> Result<SubscriptionRequest, Refusal> {
    let values = group(entries);
    let honeypot = values.iter().find(|(name, _)| *name == "site");
    if honeypot.is_some_and(|(_, list)| list.iter().any(|value| !value.is_empty())) {
        return Err(Refusal::Honeypot);
    }
    for (name, list) in &values {
        let single = SINGLE_FIELDS.contains(name);
        if !single && !MULTIPLE_FIELDS.contains(name) {
            return Err(Refusal::Field);
        }
        if single && list.len() > 1 {
            return Err(Refusal::Field);
        }
    }

    let email = normalize_email(first(&values, "courriel").unwrap_or("")).ok_or(Refusal::Email)?;

    let mut universes: Vec<String> = Vec::new();
    if let Some((_, list)) = values.iter().find(|(name, _)| *name == "univers") {
        for value in list {
            if !universes.iter().any(|known| known == value) {
                universes.push((*value).to_owned());
            }
        }
    }
    universes.sort_by(|left, right| utf16_order(left, right));
    if !universes
        .iter()
        .all(|universe| policy.universes.contains(universe))
    {
        return Err(Refusal::Field);
    }

    let followed = first(&values, "suivre").unwrap_or("");
    if !followed.is_empty() && !policy.follow.contains(followed) {
        return Err(Refusal::Field);
    }

    let tester = first(&values, "testeur");
    if tester.is_some_and(|value| value != "oui") {
        return Err(Refusal::Field);
    }

    Ok(SubscriptionRequest {
        email,
        universes,
        follow: (!followed.is_empty()).then(|| followed.to_owned()),
        tester: tester == Some("oui"),
    })
}

#[cfg(test)]
#[allow(
    clippy::unwrap_used,
    clippy::expect_used,
    clippy::panic,
    clippy::indexing_slicing
)]
mod tests {
    use super::*;
    use crate::form::search_params;
    use crate::policy::embedded;

    fn parse(body: &str) -> Result<SubscriptionRequest, Refusal> {
        parse_subscription(&search_params(body), &embedded().unwrap())
    }

    #[test]
    fn reads_a_full_form() {
        assert_eq!(
            parse(
                "courriel=a%40b.example&univers=se-proteger&univers=apprendre&univers=apprendre&suivre=P07&testeur=oui"
            ),
            Ok(SubscriptionRequest {
                email: "a@b.example".to_owned(),
                universes: vec!["apprendre".to_owned(), "se-proteger".to_owned()],
                follow: Some("P07".to_owned()),
                tester: true,
            })
        );
    }

    #[test]
    fn the_honeypot_wins_over_any_other_refusal() {
        assert_eq!(parse("x=1&site=y"), Err(Refusal::Honeypot));
        assert_eq!(
            parse("courriel=a%40b.example&site="),
            parse("courriel=a%40b.example")
        );
    }

    #[test]
    fn refuses_unknown_or_repeated_fields_and_values() {
        for body in [
            "courriel=a%40b.example&x=1",
            "courriel=a%40b.example&courriel=c%40d.example",
            "courriel=a%40b.example&univers=nope",
            "courriel=a%40b.example&suivre=constructor",
            "courriel=a%40b.example&testeur=non",
        ] {
            assert_eq!(parse(body), Err(Refusal::Field), "{body}");
        }
        assert_eq!(parse("courriel=nope"), Err(Refusal::Email));
        assert_eq!(parse(""), Err(Refusal::Email));
    }
}
