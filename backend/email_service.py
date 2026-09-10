"""Thin Resend wrapper for DP transactional emails (owner/admin account
recovery links only, for now). Never logs recipient tokens/links — callers
pass a fully-formed subject/html and this module only logs send success/
failure + the Resend message id, never the body."""
import os
import asyncio
import logging

import resend

logger = logging.getLogger("dp.email")

resend.api_key = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = os.environ.get("RESEND_FROM_EMAIL", "")
REPLY_TO = os.environ.get("RESEND_REPLY_TO", "")


async def send_email(to_email: str, subject: str, html: str):
    if not resend.api_key or not FROM_EMAIL:
        logger.warning("Resend not configured — email not sent to %s", to_email)
        return {"ok": False, "reason": "not_configured"}
    params = {"from": FROM_EMAIL, "to": [to_email], "subject": subject, "html": html}
    if REPLY_TO:
        params["reply_to"] = REPLY_TO
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        msg_id = result.get("id") if isinstance(result, dict) else None
        logger.info("Email sent to %s (id=%s)", to_email, msg_id)
        return {"ok": True, "id": msg_id}
    except Exception as e:
        logger.error("Resend send failed for %s: %s", to_email, e)
        return {"ok": False, "reason": "send_failed"}
