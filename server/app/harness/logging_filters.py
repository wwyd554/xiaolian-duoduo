"""Browser WebSocket JWTs must not appear in Uvicorn URL logs."""
import logging
import re


class WebSocketTokenFilter(logging.Filter):
    def filter(self, record):
        message = record.getMessage()
        redacted = re.sub(r"([?&]token=)[^&\s\]\"']+", r"\1[REDACTED]", message, flags=re.I)
        if redacted != message:
            record.msg = redacted
            record.args = ()
        return True
