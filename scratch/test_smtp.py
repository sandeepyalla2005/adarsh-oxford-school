import os
import smtplib
from email.message import EmailMessage

smtp_host = "smtp.gmail.com"
smtp_port = 587
smtp_username = "sandeep.yalla506@gmail.com"
smtp_password = "cozzpgdomusavewr"
smtp_from = smtp_username
use_tls = True
to_email = "sandeep.yalla506@gmail.com"

message = EmailMessage()
message["Subject"] = "Test SMTP"
message["From"] = smtp_from
message["To"] = to_email
message.set_content("This is a test email.")

try:
    with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
        if use_tls:
            server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(message)
    print(f"Email sent successfully to {to_email}")
except Exception as e:
    print(f"Failed to send email: {e}")
