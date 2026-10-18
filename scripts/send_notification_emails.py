"""Send claimed notifications. Never log email addresses, tokens, or credentials."""
from html import escape
from pathlib import Path
from string import Template
import json
import os
import smtplib
import ssl
import urllib.request
from email.message import EmailMessage

SENDER = 'hellokayleec@gmail.com'
SITE = 'https://ourlockets.com'


def api(path, payload, method='POST'):
    key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    request = urllib.request.Request(
        os.environ['SUPABASE_URL'].rstrip('/') + '/rest/v1/' + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={'apikey': key, 'Authorization': 'Bearer ' + key,
                 'Content-Type': 'application/json', 'Prefer': 'return=minimal'}, method=method)
    with urllib.request.urlopen(request, timeout=30) as response:
        content = response.read()
        return json.loads(content) if content else None


def html_for(job):
    update = job['kind'] == 'story_updates'
    count = int(job['event_count'])
    values = {
        'preheader': 'A little update is waiting. Read it whenever you feel like it.',
        'eyebrow': 'THE NEXT CHAPTER' if update else 'A LITTLE CONNECTION',
        'headline': 'wait, there’s<br>an update.' if update else ('you’ve got<br>a reply.' if count == 1 else 'you’ve got<br>replies.'),
        'description': 'The story you’re following just got a new part. Get comfy and catch up.' if update else (
            'Someone left a reply on your story. Pop back in whenever you feel like it.' if count == 1 else
            f'{count} new replies have found their way to your story. Pop back in whenever you feel like it.'),
        'button': 'Catch me up' if update else 'Read my replies',
        'story_url': escape(f"{SITE}/story/{job['story_id']}", quote=True),
        'settings_url': f'{SITE}/settings',
        'unsubscribe_url': escape(f"{SITE}/email/unsubscribe#token={job['token']}", quote=True),
    }
    return Template(Path(__file__).with_name('notification_email.html').read_text()).substitute(values)


def message_for(job):
    message = EmailMessage()
    message['From'] = 'Locket <' + SENDER + '>'
    message['To'] = job['email']
    message['Message-ID'] = '<' + job['id'] + '@ourlockets.com>'
    update = job['kind'] == 'story_updates'
    message['Subject'] = 'A story you follow has a new part on Locket' if update else "There's a new reply on Locket"
    note = 'A story you subscribed to has a new part.' if update else (
        'You have a new reply on your story.' if job['event_count'] == 1 else
        f"You have {job['event_count']} new replies on your story.")
    message.set_content(
        f"Hey,\n\n{note}\n\nRead it when you're ready:\n{SITE}/story/{job['story_id']}\n\n"
        f"You chose these notifications in Locket. Change your choices: {SITE}/settings\n"
        f"Unsubscribe: {SITE}/email/unsubscribe#token={job['token']}\n\nLocket\n")
    message.add_alternative(html_for(job), subtype='html')
    # Embed the real logo so it needs no external image request or tracking pixel.
    logo = Path(__file__).resolve().parents[1] / 'public' / 'locket-logo-focused.png'
    message.get_payload()[-1].add_related(logo.read_bytes(), maintype='image', subtype='png', cid='<locket-logo>')
    return message


def main():
    # A separate switch keeps the schedule quiet until the database is installed.
    if os.environ.get('EMAIL_NOTIFICATIONS_ENABLED') != 'true':
        print('Email delivery is disabled.')
        return
    password = os.environ['GMAIL_APP_PASSWORD'].replace(' ', '')
    # Connect before claiming, so an unavailable SMTP server cannot strand jobs.
    with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=ssl.create_default_context(), timeout=30) as smtp:
        smtp.login(SENDER, password)
        jobs = api('rpc/claim_locket_emails', {}) or []
        for job in jobs:
            try:
                # Recheck opt-in just before SMTP. Claims are intentionally never replayed.
                allowed = api('rpc/locket_email_still_allowed', {'job_id': job['id']})
                if not allowed:
                    api('email_delivery_queue?id=eq.' + job['id'], {'status': 'uncertain'}, 'PATCH')
                    continue
                smtp.send_message(message_for(job))
                api('email_delivery_queue?id=eq.' + job['id'], {'status': 'sent'}, 'PATCH')
            except Exception:
                # SMTP acceptance can be ambiguous. Do not automatically send a duplicate.
                try:
                    api('email_delivery_queue?id=eq.' + job['id'], {'status': 'uncertain'}, 'PATCH')
                finally:
                    raise RuntimeError('Delivery interrupted; inspect queue status before any manual retry.') from None
        print(f'Processed {len(jobs)} claimed notification emails.')


if __name__ == '__main__':
    main()
