"""Send one recorded host invitation. Never log addresses, keys or email contents."""
import hashlib
import json
import os
import smtplib
import ssl
from datetime import datetime
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

SUBJECT = "You're invited to host everyone’s awake night at Locket!"
SENDER = "hellokayleec@gmail.com"
FIRST_USERNAME = "cinnaxx"
FIRST_EMAIL_HASH = "5cb948478fe482bee0626bb8f0fc7a77548f1d6756bf886772b6fba52094d361"


def make_email(candidate):
    message = EmailMessage()
    message['From'] = f'Lefei at Locket <{SENDER}>'
    message['To'] = candidate['email']
    message['Reply-To'] = SENDER
    message['Subject'] = SUBJECT
    message['Date'] = formatdate(localtime=False)
    message['Message-ID'] = make_msgid(domain='gmail.com')
    first = candidate.get('first', False)
    introduction = ("I’d love for you to be our very first host." if first else
                    "You’ve been randomly selected from our community volunteers, and I’d love for you to be tonight’s host.")
    message.set_content(f"""Hi {candidate['username']},

I’m Lefei, the person behind Locket. Thank you for sharing and joining in—it means a lot to see people making this little space their own.

I’m starting something called Everyone’s Awake: a nightly thread where we can share whatever’s on our minds. {introduction}

You get to choose the question everyone answers. It could be something lighthearted, something you’ve been wondering about, or something you wish people talked about more.

If you’re interested, just reply with your idea by 6:30 p.m. Toronto time today. I’ll review it and take care of setting up the thread. No pressure at all—if today doesn’t work, we’ll use a question of our own.

Thank you for being here,
Lefei
Creator of Locket
https://ourlockets.com

To stop future host invitations, turn them off in your Locket profile or reply asking me to opt you out.
""")
    return message


class Database:
    def __init__(self, url, key):
        self.url = url.rstrip('/')
        self.key = key

    def request(self, path, payload, method='POST'):
        request = Request(self.url + path, data=json.dumps(payload).encode(), method=method,
                          headers={'apikey': self.key, 'Authorization': 'Bearer ' + self.key,
                                   'Content-Type': 'application/json', 'Prefer': 'return=representation'})
        with urlopen(request, timeout=30) as response:
            body = response.read()
            return json.loads(body) if body else None

    def state(self, night, value):
        patch = {'state': value}
        if value == 'sent':
            patch['sent_at'] = datetime.now(ZoneInfo('UTC')).isoformat()
        self.request('/rest/v1/host_invitations?night=eq.' + night, patch, 'PATCH')


def deliver(candidate, password, db, smtp_factory=smtplib.SMTP_SSL):
    night = candidate['night']
    if candidate.get('first') and (candidate['username'] != FIRST_USERNAME or
            hashlib.sha256(candidate['email'].strip().lower().encode()).hexdigest() != FIRST_EMAIL_HASH):
        db.state(night, 'failed')
        raise RuntimeError('First host identity did not match. No email sent.')
    message = make_email(candidate)
    sending = False
    try:
        with smtp_factory('smtp.gmail.com', 465, context=ssl.create_default_context(), timeout=30) as smtp:
            smtp.login(SENDER, password.replace(' ', ''))
            db.state(night, 'sending')
            sending = True
            refused = smtp.send_message(message)
            if refused:
                raise RuntimeError('Recipient refused')
            db.state(night, 'sent')
    except Exception:
        # SMTP may have accepted an email before a connection failed. Do not retry
        # automatically: preserve the claim and review Gmail Sent before recovery.
        try:
            db.state(night, 'uncertain' if sending else 'failed')
        except Exception:
            pass
        raise RuntimeError('Invitation failed or delivery is uncertain. Check the private journal and Gmail Sent; do not blindly retry.') from None


def main():
    now = datetime.now(ZoneInfo('America/Toronto'))
    if os.environ.get('GITHUB_EVENT_NAME') == 'schedule' and now.hour != 14:
        print('Outside the Toronto invitation window; no action.')
        return
    required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GMAIL_APP_PASSWORD']
    if any(not os.environ.get(key) for key in required):
        raise RuntimeError('Required repository secrets are missing.')
    if not os.environ['SUPABASE_URL'].startswith('https://'):
        raise RuntimeError('Use the HTTPS Supabase project URL.')
    db = Database(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
    candidate = db.request('/rest/v1/rpc/claim_host_invitation',
                           {'p_night': now.date().isoformat(), 'p_first_username': FIRST_USERNAME})
    if not candidate:
        print('Already claimed today or no eligible host; no email sent.')
        return
    deliver(candidate, os.environ['GMAIL_APP_PASSWORD'], db)
    print('One host invitation accepted by Gmail. Delivery journal updated.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Do not dump HTTP or SMTP responses containing recipient details.
        print('Host invitation job stopped. Check setup and private delivery journal.')
        raise SystemExit(1) from None
