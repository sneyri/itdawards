import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { domainToASCII } from 'node:url';
import nodemailer from 'nodemailer';

const { AUTH_INTERNAL_SECRET, SMTP_HOST, SMTP_PORT = '587', SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
const port = Number(SMTP_PORT);
const secure = port === 465;
const localRelay = ['127.0.0.1', 'localhost', '::1'].includes(SMTP_HOST);
const mailer = SMTP_HOST && SMTP_FROM && Number.isInteger(port) && port > 0 && port < 65536
    && Boolean(SMTP_USER) === Boolean(SMTP_PASSWORD)
    ? nodemailer.createTransport({
        host: SMTP_HOST, port, secure,
        requireTLS: !secure && !localRelay,
        auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
        connectionTimeout: 3000,
        greetingTimeout: 3000,
        socketTimeout: 5000,
    })
    : null;

function readEmail(value) {
    if (typeof value !== 'string' || value.length > 254) return null;
    const [local, rawDomain, ...extra] = value.trim().split('@');
    if (extra.length || !rawDomain || !local || local.length > 64
        || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) || /(^\.|\.$|\.\.)/.test(local)) return null;
    if (/[\s/?#:%\[\]\\]/.test(rawDomain)) return null;
    const domain = domainToASCII(rawDomain.toLowerCase());
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain)) return null;
    const name = local.toLowerCase();
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
        const mailbox = name.split('+', 1)[0].replaceAll('.', '');
        return mailbox ? `${mailbox}@gmail.com` : null;
    }
    return `${name}@${domain}`;
}

function hashCode(email, code) {
    return createHmac('sha256', AUTH_INTERNAL_SECRET).update(`email-otp\0${email}\0${code}`).digest('hex');
}

function fail(res, status, code, message) {
    return res.status(status).json({ error: { code, message } });
}

export function emailHandlers(db, createSession, setSessionCookie) {
    async function requestCode(req, res) {
        const email = readEmail(req.body?.email);
        if (!email) return fail(res, 400, 'invalid_email', 'Введите корректный email.');
        if (!mailer) return fail(res, 503, 'mail_unavailable', 'Отправка писем пока недоступна. Обратитесь к организаторам.');

        const code = String(randomInt(100_000_000)).padStart(8, '0');
        const hash = hashCode(email, code);
        await db.query("DELETE FROM auth_email_codes WHERE window_started_at < now() - interval '1 day'");
        const result = await db.query(`
            INSERT INTO auth_email_codes (email, code_hash, expires_at)
            VALUES ($1, $2, now() + interval '10 minutes')
            ON CONFLICT (email) DO UPDATE SET
                code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, used = false,
                sent_at = now(),
                sends = CASE WHEN auth_email_codes.window_started_at <= now() - interval '1 hour'
                    THEN 1 ELSE auth_email_codes.sends + 1 END,
                window_started_at = CASE WHEN auth_email_codes.window_started_at <= now() - interval '1 hour'
                    THEN now() ELSE auth_email_codes.window_started_at END
            WHERE auth_email_codes.sent_at <= now() - interval '1 minute'
                AND (auth_email_codes.sends < 5 OR auth_email_codes.window_started_at <= now() - interval '1 hour')
        `, [email, hash]);
        if (!result.rowCount) return fail(res, 429, 'email_rate_limited', 'Слишком много запросов кода. Попробуйте позже.');

        try {
            await mailer.sendMail({
                from: SMTP_FROM,
                to: email,
                subject: 'Код входа в ITD Awards',
                text: `Код входа в ITD Awards: ${code}\nКод действует 10 минут.\nЕсли вы не запрашивали вход, проигнорируйте письмо.`,
            });
        } catch {
            console.error('Email sign-in: SMTP delivery failed.');
            return fail(res, 503, 'mail_unavailable', 'Не удалось отправить письмо. Попробуйте позже.');
        }
        return res.json({ data: { sent: true } });
    }

    async function verifyCode(req, res) {
        const email = readEmail(req.body?.email);
        const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
        if (!email || !/^\d{8}$/.test(code)) {
            return fail(res, 400, 'invalid_email_code', 'Введите email и восьмизначный код.');
        }

        const client = await db.connect();
        let releaseError;
        let session;
        try {
            await client.query('BEGIN');
            const { rows: [attempt] } = await client.query(`
                UPDATE auth_email_codes SET attempts = attempts + 1, used = (code_hash = $2)
                WHERE email = $1 AND expires_at > now() AND attempts < 5 AND NOT used
                RETURNING used
            `, [email, hashCode(email, code)]);
            if (attempt?.used) {
                const { rows: [account] } = await client.query(`
                    INSERT INTO auth_accounts (provider_origin, subject, voter_id)
                    VALUES ('email', $1, $2)
                    ON CONFLICT (provider_origin, subject) DO UPDATE SET subject = EXCLUDED.subject
                    RETURNING voter_id
                `, [email, randomUUID()]);
                session = await createSession(req, account.voter_id, client);
            }
            await client.query('COMMIT');
        } catch (error) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                releaseError = rollbackError;
            }
            throw error;
        } finally {
            client.release(releaseError);
        }

        if (!session) return fail(res, 401, 'email_code_rejected', 'Код неверный, истёк или уже использован.');
        setSessionCookie(res, session);
        return res.json({ data: { signedIn: true } });
    }

    return { requestCode, verifyCode };
}
