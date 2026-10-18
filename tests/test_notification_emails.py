import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

spec = importlib.util.spec_from_file_location('sender', Path(__file__).parents[1] / 'scripts/send_notification_emails.py')
sender = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sender)
JOB = {'id': '123', 'email': 'recipient@example.com', 'token': 'a'*64,
       'story_id': '456', 'kind': 'replies', 'event_count': 4}


class NotificationEmailTests(unittest.TestCase):
    def test_private_content_and_links(self):
        message = sender.message_for(JOB)
        self.assertEqual(message['To'], JOB['email'])
        self.assertNotIn('4', message['Subject'])
        self.assertIn('4 new replies', message.get_body(preferencelist=('plain',)).get_content())
        self.assertIn('/story/456', message.get_body(preferencelist=('plain',)).get_content())
        self.assertIn('/email/unsubscribe#token=', message.get_body(preferencelist=('plain',)).get_content())
        self.assertIn('new part', sender.message_for({**JOB, 'kind': 'story_updates'})['Subject'])

    def test_html_poster_has_embedded_logo_and_private_links(self):
        message = sender.message_for(JOB)
        html = message.get_body(preferencelist=('html',)).get_content()
        self.assertIn('bgcolor="#fce2e9"', html)
        self.assertIn('you’ve got<br>replies.', html)
        self.assertIn('/story/456', html)
        self.assertIn('Unsubscribe', html)
        self.assertNotIn(JOB['email'], html)
        self.assertNotIn('<script', html)
        self.assertTrue(any(p['Content-ID'] == '<locket-logo>' for p in message.walk()))
        update = sender.html_for({**JOB, 'kind': 'story_updates'})
        self.assertIn('Catch me up', update)
        self.assertIn('wait, there’s<br>an update.', update)
        self.assertIn('&quot;', sender.html_for({**JOB, 'story_id': '\" onmouseover=\"x'}))

    def test_disabled_sends_nothing(self):
        with patch.dict(os.environ, {'EMAIL_NOTIFICATIONS_ENABLED': 'false'}), patch.object(sender, 'api') as api:
            sender.main()
            api.assert_not_called()

    def test_success_checks_consent_and_marks_sent(self):
        smtp = MagicMock()
        with patch.dict(os.environ, {'EMAIL_NOTIFICATIONS_ENABLED': 'true', 'GMAIL_APP_PASSWORD': 'test'}), patch.object(sender.smtplib, 'SMTP_SSL') as connect, patch.object(sender, 'api', side_effect=[[JOB], True, None]) as api:
            connect.return_value.__enter__.return_value = smtp
            sender.main()
            smtp.send_message.assert_called_once()
            self.assertEqual(api.call_args.args[1], {'status': 'sent'})

    def test_ambiguous_send_is_not_retried(self):
        smtp = MagicMock()
        smtp.send_message.side_effect = OSError('disconnect')
        with patch.dict(os.environ, {'EMAIL_NOTIFICATIONS_ENABLED': 'true', 'GMAIL_APP_PASSWORD': 'test'}), patch.object(sender.smtplib, 'SMTP_SSL') as connect, patch.object(sender, 'api', side_effect=[[JOB], True, None]) as api:
            connect.return_value.__enter__.return_value = smtp
            with self.assertRaises(RuntimeError):
                sender.main()
            smtp.send_message.assert_called_once()
            self.assertEqual(api.call_args.args[1], {'status': 'uncertain'})

    def test_opt_out_between_claim_and_send(self):
        smtp = MagicMock()
        with patch.dict(os.environ, {'EMAIL_NOTIFICATIONS_ENABLED': 'true', 'GMAIL_APP_PASSWORD': 'test'}), patch.object(sender.smtplib, 'SMTP_SSL') as connect, patch.object(sender, 'api', side_effect=[[JOB], False, None]):
            connect.return_value.__enter__.return_value = smtp
            sender.main()
            smtp.send_message.assert_not_called()


if __name__ == '__main__':
    unittest.main()
