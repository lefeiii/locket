import importlib.util
import unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('invite','scripts/invite_host.py')
invite=importlib.util.module_from_spec(spec);spec.loader.exec_module(invite)
class DB:
 def __init__(self):self.states=[]
 def state(self,night,state):self.states.append(state)
class SMTP:
 fail=False
 def __init__(self,*args,**kwargs):pass
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def login(self,*args):pass
 def send_message(self,message):
  if self.fail:raise TimeoutError()
  return {}
class Invitations(unittest.TestCase):
 def candidate(self):return {'night':'2026-10-12','username':'volunteer','email':'test@example.test','first':False}
 def test_subject_and_reply(self):
  m=invite.make_email(self.candidate());self.assertEqual(m['Subject'],"You're invited to host everyone’s awake night at Locket!");self.assertEqual(m['Reply-To'],invite.SENDER)
 def test_success(self):
  db=DB();invite.deliver(self.candidate(),'password',db,SMTP);self.assertEqual(db.states,['sending','sent'])
 def test_ambiguous(self):
  db=DB()
  with patch.object(SMTP,'fail',True):
   with self.assertRaises(RuntimeError):invite.deliver(self.candidate(),'password',db,SMTP)
  self.assertEqual(db.states,['sending','uncertain'])
 def test_identity(self):
  db=DB();c=self.candidate();c['first']=True
  with self.assertRaises(RuntimeError):invite.deliver(c,'password',db,SMTP)
  self.assertEqual(db.states,['failed'])
