"""Isolated advertising-enquiry notification service.

Real email (e.g. Resend) can be wired here later WITHOUT changing the submission flow.
Until an email provider is configured, this only records a non-sensitive log line and the
enquiry's own `email_notification_status` stays `not_configured` — we never pretend an
email was sent. The Admin Dashboard is the reliable notification channel for now.

When email is added, it must include the submitted details and a secure Admin Dashboard
link, and MUST NOT include any public artwork URL.
"""
import logging

logger = logging.getLogger("dp.notify")

SUPPORT_EMAIL = "support@intiesltd.com"


def notify_enquiry(doc: dict) -> str:
    """Return the email_notification_status. No provider configured yet."""
    # Deliberately log only non-sensitive identifiers (no artwork key, no full PII dump).
    logger.info("New advertising enquiry %s (%s) — review in Admin Dashboard", doc.get("id"), doc.get("package"))
    return "not_configured"
