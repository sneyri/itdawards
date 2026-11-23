import { createHmac, randomBytes } from 'node:crypto';
import { codeSecret } from '../../config.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 12;
export const CODE_TTL_SECONDS = 300;
const CODE_COOLDOWN_SECONDS = 60;

export function parseCode(value) {
    if (typeof value !== 'string' || value.length > 40) return null;
    const code = value.toUpperCase().replace(/[\s-]/g, '');
    if (code.length !== CODE_LENGTH) return null;
    return [...code].every((character) => CODE_ALPHABET.includes(character)) ? code : null;
}

export function hashCode(code) {
    return createHmac('sha256', codeSecret).update(code).digest();
}

export async function storeLoginCode(client, userId, invitationId = null, ttlSeconds = CODE_TTL_SECONDS) {
    // Callers lock the account row before checking cooldown and replacing a code.
    let code = '';
    while (code.length < CODE_LENGTH) {
        for (const byte of randomBytes(CODE_LENGTH - code.length)) {
            if (byte >= 240) continue;
            code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
            if (code.length === CODE_LENGTH) break;
        }
    }
    await client.query(`
        INSERT INTO auth_codes (user_id, code_hash, issued_at, expires_at, invitation_id)
        VALUES ($1, $2, statement_timestamp(),
            CASE WHEN $4::uuid IS NULL THEN statement_timestamp() + make_interval(secs => $3) END, $4)
        ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, issued_at = EXCLUDED.issued_at,
            expires_at = EXCLUDED.expires_at, used_at = NULL, invitation_id = EXCLUDED.invitation_id
    `, [userId, hashCode(code), ttlSeconds, invitationId]);
    return { code: code.match(/.{4}/g).join('-') };
}

export async function loginCodeCooldown(client, userId) {
    const { rows: [previous] } = await client.query(`
        SELECT ceil(extract(epoch FROM issued_at + make_interval(secs => $2) - clock_timestamp()))::int AS retry_after
        FROM auth_codes WHERE user_id = $1
    `, [userId, CODE_COOLDOWN_SECONDS]);
    return Math.max(previous?.retry_after ?? 0, 0);
}

export async function consumeLoginCode(client, code) {
    const codeHash = hashCode(code);
    const { rows: [codeOwner] } = await client.query('SELECT user_id FROM auth_codes WHERE code_hash = $1', [codeHash]);
    if (!codeOwner) return null;
    // Lock the same user row as issuance, then check that this exact code is still usable.
    const { rows: [user] } = await client.query(
        'SELECT id, display_name, role, blocked FROM users WHERE id = $1 FOR UPDATE', [codeOwner.user_id],
    );
    if (!user || user.blocked) return null;
    const { rows: [consumed] } = await client.query(`
        UPDATE auth_codes SET used_at = clock_timestamp()
        WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
            AND (expires_at IS NULL OR expires_at > clock_timestamp())
        RETURNING invitation_id, used_at
    `, [user.id, codeHash]);
    if (!consumed) return null;
    if (consumed.invitation_id) {
        await client.query('UPDATE invitation_codes SET use_count = 1 WHERE id = $1', [consumed.invitation_id]);
        await client.query('INSERT INTO invitation_uses (invitation_id, user_id, used_at) VALUES ($1, $2, $3)',
            [consumed.invitation_id, user.id, consumed.used_at]);
        await client.query(`
            INSERT INTO audit_logs (actor_id, action, target_type, target_id, details)
            VALUES ($1, 'invitation.redeemed', 'invitation', $2, $3)
        `, [user.id, consumed.invitation_id, { role: user.role }]);
    }
    const method = consumed.invitation_id ? 'invitation' : 'telegram';
    return { user, method };
}
