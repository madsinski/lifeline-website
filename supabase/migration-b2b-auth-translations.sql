-- English (and canonical Icelandic) for the B2B login / account-creation
-- screen at /business/login. The page's t() fallbacks are the Icelandic copy;
-- none of these keys existed in `translations`, so the screen showed its
-- inline fallback in both languages. Run in the Supabase SQL editor.
--
-- Idempotent. DO NOTHING on conflict so wording edited in /admin is kept.

INSERT INTO translations (key, section, context, en, is_text, approved) VALUES
('b2b.login.claimed', 'b2b', 'Business login/signup (/business/login)', 'Your account is ready. Sign in with the password you chose.', 'Aðgangurinn er tilbúinn. Skráðu þig inn með lykilorðinu sem þú valdir.', true),
('b2b.signup.password_short', 'b2b', 'Business login/signup (/business/login)', 'The password must be at least 12 characters.', 'Lykilorðið þarf að vera minnst 12 stafir.', true),
('b2b.signup.password_mismatch', 'b2b', 'Business login/signup (/business/login)', 'The passwords don''t match.', 'Lykilorðin stemma ekki.', true),
('b2b.login.email_exists', 'b2b', 'Business login/signup (/business/login)', 'This email already has a Lifeline account. Sign in with the password you already use.', 'Netfangið er þegar með Lifeline-aðgang. Skráðu þig inn með lykilorðinu sem þú notar nú þegar.', true),
('b2b.signup.invalid', 'b2b', 'Business login/signup (/business/login)', 'Check the email address and that the password is at least 12 characters.', 'Athugaðu netfangið og að lykilorðið sé minnst 12 stafir.', true),
('b2b.signup.failed', 'b2b', 'Business login/signup (/business/login)', 'Could not create the account. Please try again shortly.', 'Ekki tókst að stofna aðganginn. Reyndu aftur eftir smástund.', true),
('b2b.signup.offline', 'b2b', 'Business login/signup (/business/login)', 'No connection. Check your network and try again.', 'Engin tenging. Athugaðu netið og reyndu aftur.', true),
('b2b.login.enter_email_first', 'b2b', 'Business login/signup (/business/login)', 'Enter your email address first.', 'Sláðu fyrst inn netfangið þitt.', true),
('b2b.login.reset_sent', 'b2b', 'Business login/signup (/business/login)', 'We''ve sent you a link to choose a new password.', 'Við sendum þér hlekk til að velja nýtt lykilorð.', true),
('b2b.login.no_account', 'b2b', 'Business login/signup (/business/login)', 'Company not registered yet?', 'Fyrirtækið ekki með aðgang?', true),
('b2b.login.tab.signup', 'b2b', 'Business login/signup (/business/login)', 'Create a company account', 'Stofna fyrirtækjaaðgang', true),
('b2b.signup.have_account', 'b2b', 'Business login/signup (/business/login)', 'Already have an account?', 'Ertu þegar með aðgang?', true),
('b2b.login.tab.login', 'b2b', 'Business login/signup (/business/login)', 'Sign in', 'Skrá inn', true),
('b2b.signup.sent.title', 'b2b', 'Business login/signup (/business/login)', 'Check your inbox', 'Opnaðu póstinn þinn', true),
('b2b.signup.sent.body', 'b2b', 'Business login/signup (/business/login)', 'We''ve sent a confirmation link to the address below. Click it to confirm your email and continue registering your company.', 'Við sendum staðfestingarhlekk á netfangið hér fyrir neðan. Smelltu á hann til að staðfesta netfangið og halda áfram að skrá fyrirtækið.', true),
('b2b.signup.sent.spam', 'b2b', 'Business login/signup (/business/login)', 'Can''t find it? Check your spam folder.', 'Finnurðu hann ekki? Athugaðu ruslpóstinn.', true),
('b2b.signup.sent.wrong_email', 'b2b', 'Business login/signup (/business/login)', 'Wrong email?', 'Rangt netfang?', true),
('b2b.signup.sent.change', 'b2b', 'Business login/signup (/business/login)', 'Change', 'Breyta', true),
('b2b.signup.sent.back', 'b2b', 'Business login/signup (/business/login)', 'Back to sign in', 'Til baka í innskráningu', true),
('b2b.login.title', 'b2b', 'Business login/signup (/business/login)', 'Company sign-in', 'Innskráning fyrirtækja', true),
('b2b.login.tagline', 'b2b', 'Business login/signup (/business/login)', 'For managers who run their company''s health programme with Lifeline Health.', 'Fyrir stjórnendur sem halda utan um heilsuverkefni fyrirtækisins hjá Lifeline Health.', true),
('b2b.login.email', 'b2b', 'Business login/signup (/business/login)', 'Email', 'Netfang', true),
('b2b.login.password', 'b2b', 'Business login/signup (/business/login)', 'Password', 'Lykilorð', true),
('b2b.login.signing_in', 'b2b', 'Business login/signup (/business/login)', 'Signing in…', 'Skrái inn…', true),
('b2b.login.submit', 'b2b', 'Business login/signup (/business/login)', 'Sign in', 'Skrá inn', true),
('b2b.login.forgot', 'b2b', 'Business login/signup (/business/login)', 'Forgot your password?', 'Gleymt lykilorð?', true),
('b2b.signup.title', 'b2b', 'Business login/signup (/business/login)', 'Create a company account', 'Stofna fyrirtækjaaðgang', true),
('b2b.signup.subtitle', 'b2b', 'Business login/signup (/business/login)', 'You''ll be your company''s contact person at Lifeline Health. First create your account and confirm your email.', 'Þú verður tengiliður fyrirtækisins hjá Lifeline Health. Fyrst stofnarðu aðganginn þinn og staðfestir netfangið.', true),
('b2b.signup.full_name', 'b2b', 'Business login/signup (/business/login)', 'Full name', 'Fullt nafn', true),
('b2b.signup.email', 'b2b', 'Business login/signup (/business/login)', 'Work email', 'Netfang í vinnu', true),
('b2b.signup.password', 'b2b', 'Business login/signup (/business/login)', 'Password', 'Lykilorð', true),
('b2b.signup.password_placeholder', 'b2b', 'Business login/signup (/business/login)', 'At least 12 characters', 'Minnst 12 stafir', true),
('b2b.signup.confirm_password', 'b2b', 'Business login/signup (/business/login)', 'Repeat the password', 'Endurtaktu lykilorðið', true),
('b2b.signup.creating', 'b2b', 'Business login/signup (/business/login)', 'Creating account…', 'Stofna aðgang…', true),
('b2b.signup.submit', 'b2b', 'Business login/signup (/business/login)', 'Create account', 'Stofna aðgang', true),
('b2b.signup.footer_note', 'b2b', 'Business login/signup (/business/login)', 'Next steps: confirm your email, accept the terms of service and data processing agreement, register the company and invite your staff.', 'Næstu skref: þú staðfestir netfangið, samþykkir notkunarskilmála og vinnslusamning, skráir fyrirtækið og býður starfsfólki.', true)
ON CONFLICT (key) DO NOTHING;
