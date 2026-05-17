import smtplib
from email.message import EmailMessage
import os

def test_smtp():
    smtp_host = "smtp.gmail.com"
    smtp_port = 587
    smtp_username = "sandeep.0oxford07@gmail.com"
    smtp_password = "fgibhwiokkyrsvjr" # Latest App Password
    smtp_from = smtp_username
    recipient = "sandeep.0oxford07@gmail.com"

    print(f"Testing SMTP for {smtp_username}...")
    try:
        msg = EmailMessage()
        msg.set_content("SMTP Test Successful")
        msg["Subject"] = "Test"
        msg["From"] = smtp_from
        msg["To"] = recipient

        server = smtplib.SMTP(smtp_host, smtp_port)
        server.set_debuglevel(1)
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(msg)
        server.quit()
        print("SUCCESS")
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    test_smtp()
