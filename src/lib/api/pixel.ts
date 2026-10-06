import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { AIKeyProvider, GeminiKeyStatus, PixelKeyProvider, SearchKeyProvider } from "@/lib/pixel-store";

const providerSchema = z.enum(["gemini", "groq", "openrouter", "tavily", "jina"]);
const keyIdSchema = z.string().min(1).max(100);
const SHARED_OWNER = "shared";
const isAIProvider = (provider: PixelKeyProvider): provider is AIKeyProvider =>
  provider === "gemini" || provider === "groq" || provider === "openrouter";

export const PIXEL_SETTINGS_QUERY_KEY = ["pixel-settings"] as const;

export type PixelKeyMetadata = {
  id: string;
  provider: PixelKeyProvider;
  name: string;
  status: GeminiKeyStatus;
  checkedAt: string | null;
  hint: string;
};

export type PixelSettingsPayload = {
  keys: PixelKeyMetadata[];
  mandatoryRules: string;
  memories: string;
};

export type PixelConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};

export type PixelConversationMessage = {
  id: string;
  role: "user" | "pixel";
  content: string;
  createdAt: string;
};

function maskKey(value: string) {
  const text = value.trim();
  if (text.length <= 8) return "••••••••";
  return `${text.slice(0, 4)}••••${text.slice(-4)}`;
}

async function hintFromRow(row: Record<string, unknown>, rawKey?: string) {
  if (rawKey) return maskKey(rawKey);
  if (!row.key_ciphertext || !row.key_nonce || !row.key_auth_tag) return "••••••••";
  const { decryptSecret } = await import("@/lib/pixel-encryption.server");
  return maskKey(
    decryptSecret({
      ciphertext: String(row.key_ciphertext),
      nonce: String(row.key_nonce),
      authTag: String(row.key_auth_tag),
    }),
  );
}

async function mapKey(row: Record<string, unknown>, rawKey?: string): Promise<PixelKeyMetadata> {
  return {
    id: String(row.id),
    provider: String(row.provider) as PixelKeyProvider,
    name: String(row.name),
    status: String(row.status) as GeminiKeyStatus,
    checkedAt: row.checked_at == null ? null : String(row.checked_at),
    hint: await hintFromRow(row, rawKey),
  };
}

export const fetchPixelSettings = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<PixelSettingsPayload> => {
    const sql = await getSql();
    const [keys, preferences] = await Promise.all([
      sql`select id, provider, name, status, checked_at, key_ciphertext, key_nonce, key_auth_tag from pixel_ai_keys where user_id = ${SHARED_OWNER} order by created_at`,
      sql`select mandatory_rules, memories from pixel_preferences where user_id = ${SHARED_OWNER}`,
    ]);
    return {
      keys: await Promise.all(keys.map((row) => mapKey(row as Record<string, unknown>))),
      mandatoryRules: String(preferences[0]?.mandatory_rules ?? ""),
      memories: String(preferences[0]?.memories ?? ""),
    };
  });

export const savePixelKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    id: keyIdSchema.optional(),
    provider: providerSchema,
    name: z.string().trim().min(1).max(80),
    key: z.string().trim().max(500).optional(),
  }))
  .handler(async ({ data }): Promise<PixelKeyMetadata> => {
    const sql = await getSql();
    const { randomUUID } = await import("node:crypto");
    const id = data.id ?? randomUUID();
    const existing = data.id
      ? await sql`select id, provider from pixel_ai_keys where id = ${id} and user_id = ${SHARED_OWNER}`
      : [];

    if (data.id && existing.length === 0) {
      throw new Error("Không tìm thấy API key cần cập nhật.");
    }
    if (existing.length > 0 && !data.key) {
      if (String(existing[0]?.provider) !== data.provider) {
        throw new Error("Cần nhập API key mới khi đổi nhà cung cấp.");
      }
      const rows = await sql`
        update pixel_ai_keys set name = ${data.name}, updated_at = now()
        where id = ${id} and user_id = ${SHARED_OWNER}
        returning id, provider, name, status, checked_at, key_ciphertext, key_nonce, key_auth_tag
      `;
      return await mapKey(rows[0] as Record<string, unknown>);
    }
    if (!data.key) throw new Error("Hãy nhập API key.");

    const { encryptSecret } = await import("@/lib/pixel-encryption.server");
    const encrypted = encryptSecret(data.key);
    const rows = existing.length > 0
      ? await sql`
          update pixel_ai_keys
          set provider = ${data.provider}, name = ${data.name},
              key_ciphertext = ${encrypted.ciphertext}, key_nonce = ${encrypted.nonce},
              key_auth_tag = ${encrypted.authTag}, status = 'untested',
              checked_at = null, updated_at = now()
          where id = ${id} and user_id = ${SHARED_OWNER}
          returning id, provider, name, status, checked_at, key_ciphertext, key_nonce, key_auth_tag
        `
      : await sql`
          insert into pixel_ai_keys
            (id, user_id, provider, name, key_ciphertext, key_nonce, key_auth_tag)
          values
            (${id}, ${SHARED_OWNER}, ${data.provider}, ${data.name},
             ${encrypted.ciphertext}, ${encrypted.nonce}, ${encrypted.authTag})
          returning id, provider, name, status, checked_at, key_ciphertext, key_nonce, key_auth_tag
        `;
    return await mapKey(rows[0] as Record<string, unknown>);
  });

export const deletePixelKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: keyIdSchema }))
  .handler(async ({ data }): Promise<{ deleted: true }> => {
    const sql = await getSql();
    const rows = await sql`
      delete from pixel_ai_keys where id = ${data.id} and user_id = ${SHARED_OWNER}
      returning id
    `;
    if (rows.length === 0) throw new Error("Không tìm thấy API key cần xóa.");
    return { deleted: true };
  });

export const testPixelKey = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: keyIdSchema }))
  .handler(async ({ data }): Promise<{ status: GeminiKeyStatus; checkedAt: string }> => {
    const sql = await getSql();
    const rows = await sql`
      select id, provider, key_ciphertext, key_nonce, key_auth_tag
      from pixel_ai_keys where id = ${data.id} and user_id = ${SHARED_OWNER}
    `;
    if (rows.length === 0) throw new Error("Không tìm thấy API key cần kiểm tra.");
    const { decryptSecret } = await import("@/lib/pixel-encryption.server");
    const row = rows[0] as Record<string, unknown>;
    const provider = String(row.provider) as PixelKeyProvider;
    const key = decryptSecret({
      ciphertext: String(row.key_ciphertext),
      nonce: String(row.key_nonce),
      authTag: String(row.key_auth_tag),
    });
    const active = isAIProvider(provider)
      ? await (await import("@/lib/pixel-ai.server")).checkAIKey(provider, key)
      : await (await import("@/lib/pixel-search.server")).checkSearchKey(provider as SearchKeyProvider, key);
    const checkedAt = new Date().toISOString();
    const status: GeminiKeyStatus = active ? "active" : "inactive";
    await sql`
      update pixel_ai_keys set status = ${status}, checked_at = ${checkedAt}, updated_at = now()
      where id = ${data.id} and user_id = ${SHARED_OWNER}
    `;
    return { status, checkedAt };
  });

export const testAllPixelKeys = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async (): Promise<{
    results: { id: string; status: GeminiKeyStatus | null; checkedAt: string | null; error?: string }[];
  }> => {
    const sql = await getSql();
    const rows = await sql`
      select id, provider, key_ciphertext, key_nonce, key_auth_tag
      from pixel_ai_keys where user_id = ${SHARED_OWNER} order by created_at
    `;
    if (rows.length === 0) return { results: [] };
    const { decryptSecret } = await import("@/lib/pixel-encryption.server");
    const results: { id: string; status: GeminiKeyStatus | null; checkedAt: string | null; error?: string }[] = [];
    for (const raw of rows) {
      const row = raw as Record<string, unknown>;
      try {
        const provider = String(row.provider) as PixelKeyProvider;
        const key = decryptSecret({
          ciphertext: String(row.key_ciphertext),
          nonce: String(row.key_nonce),
          authTag: String(row.key_auth_tag),
        });
        const active = isAIProvider(provider)
          ? await (await import("@/lib/pixel-ai.server")).checkAIKey(provider, key)
          : await (await import("@/lib/pixel-search.server")).checkSearchKey(provider as SearchKeyProvider, key);
        const checkedAt = new Date().toISOString();
        const status: GeminiKeyStatus = active ? "active" : "inactive";
        await sql`
          update pixel_ai_keys set status = ${status}, checked_at = ${checkedAt}, updated_at = now()
          where id = ${String(row.id)} and user_id = ${SHARED_OWNER}
        `;
        results.push({ id: String(row.id), status, checkedAt });
      } catch (error) {
        results.push({
          id: String(row.id),
          status: null,
          checkedAt: null,
          error: error instanceof Error ? error.message : "Không xác định được nguyên nhân",
        });
      }
    }
    return { results };
  });

export const savePixelPreferences = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    mandatoryRules: z.string().max(12_000).optional(),
    memories: z.string().max(12_000).optional(),
  }).refine((value) => value.mandatoryRules !== undefined || value.memories !== undefined))
  .handler(async ({ data }): Promise<PixelSettingsPayload> => {
    const sql = await getSql();
    await sql`
      insert into pixel_preferences (user_id, mandatory_rules, memories)
      values (${SHARED_OWNER}, ${data.mandatoryRules ?? ""}, ${data.memories ?? ""})
      on conflict (user_id) do update set
        mandatory_rules = coalesce(${data.mandatoryRules ?? null}, pixel_preferences.mandatory_rules),
        memories = coalesce(${data.memories ?? null}, pixel_preferences.memories),
        updated_at = now()
    `;
    const [keys, preferences] = await Promise.all([
      sql`select id, provider, name, status, checked_at, key_ciphertext, key_nonce, key_auth_tag from pixel_ai_keys where user_id = ${SHARED_OWNER} order by created_at`,
      sql`select mandatory_rules, memories from pixel_preferences where user_id = ${SHARED_OWNER}`,
    ]);
    return {
      keys: await Promise.all(keys.map((row) => mapKey(row as Record<string, unknown>))),
      mandatoryRules: String(preferences[0]?.mandatory_rules ?? ""),
      memories: String(preferences[0]?.memories ?? ""),
    };
  });

export const savePixelMemorySuggestion = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    suggestion: z.string().trim().min(1).max(500).refine((value) => !/[\r\n]/.test(value)),
  }))
  .handler(async ({ data }): Promise<{ memories: string }> => {
    const sql = await getSql();
    const rows = await sql`
      insert into pixel_preferences (user_id, memories)
      values (${SHARED_OWNER}, ${data.suggestion})
      on conflict (user_id) do update set
        memories = case
          when position(E'\n' || excluded.memories || E'\n' in E'\n' || pixel_preferences.memories || E'\n') = 0
            then concat_ws(E'\n', nullif(pixel_preferences.memories, ''), excluded.memories)
          else pixel_preferences.memories
        end,
        updated_at = now()
      where position(E'\n' || excluded.memories || E'\n' in E'\n' || pixel_preferences.memories || E'\n') > 0
        or length(pixel_preferences.memories) + length(excluded.memories)
          + case when pixel_preferences.memories = '' then 0 else 1 end <= 12000
      returning memories
    `;
    if (rows.length === 0) throw new Error("Phần ghi nhớ đã đạt giới hạn 12.000 ký tự. Hãy xóa bớt nội dung rồi thử lại.");
    return { memories: String(rows[0]?.memories ?? "") };
  });

export const fetchPixelConversations = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<PixelConversationSummary[]> => {
    const sql = await getSql();
    const rows = await sql`
      select c.id, c.title, c.updated_at, count(m.id)::int as message_count
      from pixel_conversations c
      left join pixel_messages m on m.conversation_id = c.id and m.user_id = c.user_id
      where c.user_id = ${SHARED_OWNER}
      group by c.id, c.title, c.updated_at
      order by c.updated_at desc
    `;
    return rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      updatedAt: String(row.updated_at),
      messageCount: Number(row.message_count ?? 0),
    }));
  });

export const fetchPixelConversation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: keyIdSchema }))
  .handler(async ({ data }): Promise<{ id: string; title: string; messages: PixelConversationMessage[] }> => {
    const sql = await getSql();
    const conversations = await sql`
      select id, title from pixel_conversations where id = ${data.id} and user_id = ${SHARED_OWNER}
    `;
    if (conversations.length === 0) throw new Error("Không tìm thấy hội thoại.");
    const messages = await sql`
      select id, role, content, created_at from pixel_messages
      where conversation_id = ${data.id} and user_id = ${SHARED_OWNER}
      order by created_at, id
    `;
    return {
      id: data.id,
      title: String(conversations[0]?.title),
      messages: messages.map((row) => ({
        id: String(row.id),
        role: String(row.role) as "user" | "pixel",
        content: String(row.content),
        createdAt: String(row.created_at),
      })),
    };
  });

export const deletePixelConversations = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ ids: z.array(keyIdSchema).min(1).max(100) }))
  .handler(async ({ data }): Promise<{ deleted: number }> => {
    const sql = await getSql();
    const rows = await sql`
      delete from pixel_conversations
      where user_id = ${SHARED_OWNER} and id = any(${data.ids})
      returning id
    `;
    return { deleted: rows.length };
  });

export const savePixelExchange = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    conversationId: keyIdSchema.optional(),
    prompt: z.string().trim().min(1).max(5000),
    answer: z.string().trim().min(1).max(10000),
  }))
  .handler(async ({ data }): Promise<{ conversationId: string }> => {
    const sql = await getSql();
    const { randomUUID } = await import("node:crypto");
    const conversationId = data.conversationId ?? randomUUID();
    if (data.conversationId) {
      const existing = await sql`
        select id from pixel_conversations where id = ${conversationId} and user_id = ${SHARED_OWNER}
      `;
      if (existing.length === 0) throw new Error("Không tìm thấy hội thoại.");
    } else {
      await sql`
        insert into pixel_conversations (id, user_id, title)
        values (${conversationId}, ${SHARED_OWNER}, ${data.prompt.slice(0, 80)})
      `;
    }
    await sql`
      insert into pixel_messages (id, conversation_id, user_id, role, content)
      values
        (${randomUUID()}, ${conversationId}, ${SHARED_OWNER}, 'user', ${data.prompt}),
        (${randomUUID()}, ${conversationId}, ${SHARED_OWNER}, 'pixel', ${data.answer})
    `;
    await sql`
      update pixel_conversations set updated_at = now()
      where id = ${conversationId} and user_id = ${SHARED_OWNER}
    `;
    return { conversationId };
  });

export const sendPixelMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({
    conversationId: keyIdSchema.optional(),
    prompt: z.string().trim().min(1).max(5000),
    portfolioContext: z.string().max(60_000),
    portfolioSymbols: z.array(z.string().max(20)).max(100),
  }))
  .handler(async ({ data }): Promise<{
    conversationId: string;
    answer: string;
    memorySuggestion?: string;
    sources?: { title: string; url: string; publishedDate?: string }[];
  }> => {
    const sql = await getSql();
    const { randomUUID } = await import("node:crypto");
    const keyRows = await sql`
      select id, provider, name, key_ciphertext, key_nonce, key_auth_tag
      from pixel_ai_keys where user_id = ${SHARED_OWNER} and status != 'inactive'
      order by created_at
    `;
    const aiRows = keyRows.filter((row) => isAIProvider(String((row as Record<string, unknown>).provider) as PixelKeyProvider));
    if (aiRows.length === 0) {
      throw new Error("Chưa có API key AI đang hoạt động. Hãy thêm key trong Cài đặt.");
    }
    const conversationId = data.conversationId ?? randomUUID();
    if (data.conversationId) {
      const existing = await sql`
        select id from pixel_conversations where id = ${conversationId} and user_id = ${SHARED_OWNER}
      `;
      if (existing.length === 0) throw new Error("Không tìm thấy hội thoại.");
    } else {
      await sql`
        insert into pixel_conversations (id, user_id, title)
        values (${conversationId}, ${SHARED_OWNER}, ${data.prompt.slice(0, 80)})
      `;
    }
    await sql`
      insert into pixel_messages (id, conversation_id, user_id, role, content)
      values (${randomUUID()}, ${conversationId}, ${SHARED_OWNER}, 'user', ${data.prompt})
    `;

    const [preferences, historyRows] = await Promise.all([
      sql`select mandatory_rules, memories from pixel_preferences where user_id = ${SHARED_OWNER}`,
      sql`
        select role, content from pixel_messages
        where conversation_id = ${conversationId} and user_id = ${SHARED_OWNER}
        order by created_at desc, id desc limit 12
      `,
    ]);
    const { decryptSecret } = await import("@/lib/pixel-encryption.server");
    const decryptedKeys = aiRows.map((row) => {
      const value = row as Record<string, unknown>;
      return {
        id: String(value.id),
        provider: String(value.provider) as PixelKeyProvider,
        name: String(value.name),
        value: decryptSecret({
          ciphertext: String(value.key_ciphertext),
          nonce: String(value.key_nonce),
          authTag: String(value.key_auth_tag),
        }),
      };
    });
    const aiKeys = decryptedKeys.filter((key): key is typeof key & { provider: AIKeyProvider } => isAIProvider(key.provider));
    const searchRows = keyRows.filter((row) => !isAIProvider(String((row as Record<string, unknown>).provider) as PixelKeyProvider));
    const searchKeys = searchRows.map((row) => {
      const value = row as Record<string, unknown>;
      return {
        provider: String(value.provider) as SearchKeyProvider,
        name: String(value.name),
        value: decryptSecret({
          ciphertext: String(value.key_ciphertext),
          nonce: String(value.key_nonce),
          authTag: String(value.key_auth_tag),
        }),
      };
    });
    const searchResults = (await import("@/lib/pixel-search.server"));
    const webSources = searchResults.isWebSearchNeeded(data.prompt)
      ? await searchResults.searchPixelWeb(
          searchKeys,
          searchResults.buildPixelSearchQuery(data.prompt, data.portfolioSymbols),
        )
      : [];
    const prefs = preferences[0];
    const { askWithKeys } = await import("@/lib/pixel-ai.server");
    const reply = await askWithKeys({
      keys: aiKeys,
      prompt: data.prompt,
      portfolioContext: data.portfolioContext,
      mandatoryRules: String(prefs?.mandatory_rules ?? ""),
      memories: String(prefs?.memories ?? ""),
      history: historyRows.reverse().map((row) => ({
        role: String(row.role) as "user" | "pixel",
        content: String(row.content),
      })),
      webSources,
      webSearchPerformed: searchResults.isWebSearchNeeded(data.prompt),
      onKeyStatus: async (keyId, active) => {
        const status = active ? "active" : "inactive";
        await sql`
          update pixel_ai_keys set status = ${status}, checked_at = now(), updated_at = now()
          where id = ${keyId} and user_id = ${SHARED_OWNER}
        `;
      },
    });
    const storedAnswer = webSources.length
      ? `${reply.answer}\n\nNguồn tham khảo:\n${webSources.map((source, index) => `[${index + 1}] ${source.title} — ${source.url}`).join("\n")}`
      : reply.answer;
    await sql`
      insert into pixel_messages (id, conversation_id, user_id, role, content)
      values (${randomUUID()}, ${conversationId}, ${SHARED_OWNER}, 'pixel', ${storedAnswer})
    `;
    await sql`
      update pixel_conversations set updated_at = now()
      where id = ${conversationId} and user_id = ${SHARED_OWNER}
    `;
    return {
      conversationId,
      answer: reply.answer,
      ...(reply.memorySuggestion ? { memorySuggestion: reply.memorySuggestion } : {}),
      ...(webSources.length ? { sources: webSources.map(({ title, url, publishedDate }) => ({ title, url, ...(publishedDate ? { publishedDate } : {}) })) } : {}),
    };
  });
