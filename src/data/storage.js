import { supabase } from '../lib/supabaseClient';

/* =====================================================================
   Ø·Ø¨Ù‚Ø© Ø§Ù„ÙˆØµÙˆÙ„ Ù„Ù„Ø¨ÙŠØ§Ù†Ø§Øª (Data Access Layer)
   ---------------------------------------------------------------------
   ÙƒÙ„ Ù‚Ø±Ø§Ø¡Ø© Ø£Ùˆ ÙƒØªØ§Ø¨Ø© Ù„Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª ÙÙŠ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ ÙƒÙ„Ù‡ ØªÙ…Ø± Ù…Ù† Ù‡Ø°Ø§ Ø§Ù„Ù…Ù„Ù
   Ø­ØµØ±ÙŠØ§Ù‹. Ù„Ø§ ÙŠØ³ØªÙˆØ±Ø¯ Ø£ÙŠ Ù…ÙƒÙˆÙ‘Ù† supabaseClient Ù…Ø¨Ø§Ø´Ø±Ø© â€” Ù„Ùˆ ØªØºÙŠÙ‘Ø± Ù…Ø²ÙˆÙ‘Ø¯
   Ø§Ù„ØªØ®Ø²ÙŠÙ† Ù…Ø³ØªÙ‚Ø¨Ù„Ø§Ù‹ØŒ Ù‡Ø°Ø§ Ù‡Ùˆ Ø§Ù„Ù…Ù„Ù Ø§Ù„ÙˆØ­ÙŠØ¯ Ø§Ù„Ø°ÙŠ ÙŠÙØ¹Ø¯ÙŽÙ‘Ù„.

   Ù†Ù…ÙˆØ°Ø¬ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª (Ù†Ù…ÙˆØ°Ø¬ "Ø§Ù„Ø¯ÙØªØ±"):
   - pages: ÙˆØ±Ù‚Ø© Ù„ÙŠÙˆÙ… Ù…Ø­Ø¯Ø¯ (page_date) â€” ÙˆØ§Ù„ÙŠÙˆÙ… Ø§Ù„ÙˆØ§Ø­Ø¯ Ù‚Ø¯ ÙŠÙ…Ù„Ùƒ Ø£ÙƒØ«Ø±
     Ù…Ù† ØµÙØ­Ø© (page_no: 1ØŒ 2ØŒ ...)
   - blocks: Ø³Ø·ÙˆØ± Ø§Ù„ØµÙØ­Ø© â€” Ù†Øµ Ø­Ø± Ø£Ùˆ Ù…Ù‡Ù…Ø© (kind)ØŒ ÙˆÙ‚Ø¯ ÙŠÙƒÙˆÙ† Ø§Ù„Ø³Ø·Ø±
     ÙØ±Ø¹ÙŠØ§Ù‹ ØªØ­Øª Ù…Ù‡Ù…Ø© (parent_id) ÙƒÙ…Ù‡Ù…Ø© Ø¬Ø§Ù†Ø¨ÙŠØ© Ø£Ùˆ ØªØ¹Ù„ÙŠÙ‚
   - countdowns: Ø§Ù„Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„ØªÙ†Ø§Ø²Ù„ÙŠØ©
   - app_settings: Ø±Ù…Ø² Ø§Ù„Ø¯Ø®ÙˆÙ„ (Ø¹Ø¨Ø± Ø¯ÙˆØ§Ù„ RPC ÙÙ‚Ø·)
   ===================================================================== */

/** ÙŠÙÙƒÙ‘ Ù†ØªÙŠØ¬Ø© Supabase: ÙŠØ±Ù…ÙŠ Ø®Ø·Ø£Ù‹ ÙˆØ§Ø¶Ø­Ø§Ù‹ Ø£Ùˆ ÙŠØ¹ÙŠØ¯ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª */
function unwrap({ data, error }) {
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

function dayRange(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/* ---------------------------------------------------------------------
   1. Ø±Ù…Ø² Ø§Ù„Ø¯Ø®ÙˆÙ„ (PIN)
   Ø§Ù„ØªØ­Ù‚Ù‚ ÙŠØªÙ… Ø¯Ø§Ø®Ù„ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø¹Ø¨Ø± Ø¯ÙˆØ§Ù„ RPC â€” Ø§Ù„Ù€ hash Ù„Ø§ ÙŠØµÙ„
   Ù„Ù„Ù…ØªØµÙØ­ Ø£Ø¨Ø¯Ø§Ù‹ØŒ ÙˆØ§Ù„Ù…Ù‚Ø§Ø±Ù†Ø© ØªØ¬Ø±ÙŠ Ø¨Ù€ bcrypt Ø¹Ù„Ù‰ Ø§Ù„Ø®Ø§Ø¯Ù….
   --------------------------------------------------------------------- */

export async function hasPin() {
  return unwrap(await supabase.rpc('has_pin'));
}

export async function setupPin(pin) {
  return unwrap(await supabase.rpc('setup_pin', { p_pin: pin }));
}

export async function verifyPin(pin) {
  return unwrap(await supabase.rpc('verify_pin', { p_pin: pin }));
}

export async function changePin(oldPin, newPin) {
  return unwrap(
    await supabase.rpc('change_pin', { p_old_pin: oldPin, p_new_pin: newPin })
  );
}

/* ---------------------------------------------------------------------
   2. Ø§Ù„ØµÙØ­Ø§Øª Ø§Ù„ÙŠÙˆÙ…ÙŠØ©
   --------------------------------------------------------------------- */

/** ØµÙØ­Ø§Øª ÙŠÙˆÙ… Ù…Ø­Ø¯Ø¯ Ù…Ø¹ Ø³Ø·ÙˆØ±Ù‡Ø§ØŒ Ù…Ø±ØªØ¨Ø© (Ø±Ù‚Ù… Ø§Ù„ØµÙØ­Ø© Ø«Ù… Ù…ÙˆØ¶Ø¹ Ø§Ù„Ø³Ø·Ø±) */
export async function getDayPages(dateKey) {
  return unwrap(
    await supabase
      .from('pages')
      .select('*, blocks(*)')
      .eq('page_date', dateKey)
      .order('page_no')
      .order('position', { referencedTable: 'blocks' })
  );
}

/** Ø¥Ù†Ø´Ø§Ø¡ ØµÙØ­Ø© Ø¬Ø¯ÙŠØ¯Ø© Ù„ÙŠÙˆÙ… (Ø±Ù‚Ù…Ù‡Ø§ Ø§Ù„ØªØ§Ù„ÙŠ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ø­Ø³Ø¨ Ø§Ù„Ù…ÙˆØ¬ÙˆØ¯) */
export async function createPage(dateKey, pageNo) {
  return unwrap(
    await supabase
      .from('pages')
      .insert({ page_date: dateKey, page_no: pageNo })
      .select()
      .single()
  );
}

export async function updatePage(id, patch) {
  return unwrap(
    await supabase.from('pages').update(patch).eq('id', id).select().single()
  );
}

export async function deletePage(id) {
  unwrap(await supabase.from('pages').delete().eq('id', id));
}

/* ---------------------------------------------------------------------
   3. Ø§Ù„Ø³Ø·ÙˆØ± (blocks)
   --------------------------------------------------------------------- */

/** Ø¥Ø¶Ø§ÙØ© Ø³Ø·Ø±. fields: { page_id, kind, content, parent_id?, position } */
export async function createBlock(fields) {
  return unwrap(
    await supabase.from('blocks').insert(fields).select().single()
  );
}

export async function updateBlock(id, patch) {
  return unwrap(
    await supabase.from('blocks').update(patch).eq('id', id).select().single()
  );
}

/** ØªØ£Ø´ÙŠØ± Ø§Ù„Ø¥ÙƒÙ…Ø§Ù„ â€” Ù‚Ø§Ø¹Ø¯Ø© Ø¹Ù…Ù„: completed_at ØªÙÙ…Ù„Ø£ Ø§Ù„Ø¢Ù† Ø£Ùˆ ØªÙÙØ±ÙŽÙ‘Øº */
export async function setBlockCompleted(id, done) {
  return updateBlock(id, {
    is_completed: done,
    completed_at: done ? new Date().toISOString() : null,
  });
}

export async function listCompletedTasksForDay(dateKey) {
  const { start, end } = dayRange(dateKey);
  return unwrap(
    await supabase
      .from('blocks')
      .select('*, pages(id, page_date, page_no, title)')
      .eq('kind', 'task')
      .eq('is_completed', true)
      .gte('completed_at', start)
      .lt('completed_at', end)
      .order('completed_at', { ascending: false })
  );
}

export async function deleteBlock(id) {
  unwrap(await supabase.from('blocks').delete().eq('id', id));
}

/* ---------------------------------------------------------------------
   4. Ø§Ù„Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„ØªÙ†Ø§Ø²Ù„ÙŠØ©
   --------------------------------------------------------------------- */

export async function listCountdowns() {
  return unwrap(
    await supabase
      .from('countdowns')
      .select('*')
      .order('target_date', { ascending: true })
  );
}

export async function createCountdown(fields) {
  return unwrap(
    await supabase.from('countdowns').insert(fields).select().single()
  );
}

export async function deleteCountdown(id) {
  unwrap(await supabase.from('countdowns').delete().eq('id', id));
}

/* ---------------------------------------------------------------------
   5. Ø§Ù„ØªØµØ¯ÙŠØ± ÙˆØ§Ù„Ø§Ø³ØªÙŠØ±Ø§Ø¯ (Ù†Ø³Ø®Ø© v2 â€” Ù†Ù…ÙˆØ°Ø¬ Ø§Ù„Ø¯ÙØªØ±)
   --------------------------------------------------------------------- */

/** ÙƒØ§Ù…Ù„ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ù„Ø­Ø¸Ø© Ø§Ù„Ø·Ù„Ø¨ â€” Ù„Ù„Ù†Ø³Ø® Ø§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠ ÙˆÙ„Ù„Ù…Ù„Ø®Øµ ÙˆÙ„Ù„ØªÙ‚ÙˆÙŠÙ… ÙˆÙ„Ù„Ø·Ø¨Ø§Ø¹Ø© */
export async function exportAll() {
  const [pages, blocks, countdowns] = await Promise.all([
    unwrap(await supabase.from('pages').select('*').order('page_date').order('page_no')),
    unwrap(await supabase.from('blocks').select('*').order('position')),
    listCountdowns(),
  ]);
  return {
    app: 'kitabi',
    version: 2,
    exported_at: new Date().toISOString(),
    pages,
    blocks,
    countdowns,
  };
}

/**
 * Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ù†Ø³Ø®Ø© Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© (v2): ØªÙ…Ø³Ø­ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø­Ø§Ù„ÙŠØ© ÙƒÙ„Ù‡Ø§ Ø«Ù… ØªÙØ¯Ø®Ù„
 * Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù†Ø³Ø®Ø©. Ø¹Ù…Ù„ÙŠØ© Ù…Ø¯Ù…Ù‘Ø±Ø© â€” Ø§Ù„ØªØ£ÙƒÙŠØ¯ Ù…Ø³Ø¤ÙˆÙ„ÙŠØ© ÙˆØ§Ø¬Ù‡Ø© Ø§Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù….
 */
export async function importAll(backup) {
  if (
    !backup ||
    backup.app !== 'kitabi' ||
    backup.version !== 2 ||
    !Array.isArray(backup.pages) ||
    !Array.isArray(backup.blocks) ||
    !Array.isArray(backup.countdowns)
  ) {
    throw new Error('Ø§Ù„Ù…Ù„Ù Ù„ÙŠØ³ Ù†Ø³Ø®Ø© Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© ØµØ§Ù„Ø­Ø© Ù…Ù† ÙƒØªØ§Ø¨ÙŠ (Ø§Ù„Ø¥ØµØ¯Ø§Ø± 2)');
  }

  const wipe = (table) =>
    supabase.from(table).delete().gte('created_at', '1970-01-01');
  unwrap(await wipe('blocks'));
  unwrap(await wipe('pages'));
  unwrap(await wipe('countdowns'));

  const CHUNK = 500;
  const insertAll = async (table, rows) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      unwrap(await supabase.from(table).insert(rows.slice(i, i + CHUNK)));
    }
  };

  await insertAll('pages', backup.pages);
  // Ø§Ù„Ø³Ø·ÙˆØ± Ø§Ù„ÙØ±Ø¹ÙŠØ© ØªØ´ÙŠØ± Ù„Ø¢Ø¨Ø§Ø¦Ù‡Ø§ (FK) â€” Ù†Ø¯Ø®Ù„ Ø§Ù„Ø¬Ø°ÙˆØ± Ø£ÙˆÙ„Ø§Ù‹ Ø«Ù… Ø§Ù„Ø£Ø¨Ù†Ø§Ø¡
  const roots = backup.blocks.filter((b) => !b.parent_id);
  const children = backup.blocks.filter((b) => b.parent_id);
  await insertAll('blocks', roots);
  await insertAll('blocks', children);
  await insertAll('countdowns', backup.countdowns);
}

/* ---------------------------------------------------------------------
   6. Ø§Ù„ØªØ²Ø§Ù…Ù† Ø§Ù„Ù„Ø­Ø¸ÙŠ (Realtime)
   --------------------------------------------------------------------- */

/**
 * Ø§Ø´ØªØ±Ø§Ùƒ Ø¨ØªØºÙŠÙŠØ±Ø§Øª Ø¬Ø¯ÙˆÙ„ Ø£Ùˆ Ø£ÙƒØ«Ø±. ÙŠØ¹ÙŠØ¯ Ø¯Ø§Ù„Ø© Ù„Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ.
 * onChange ØªÙØ³ØªØ¯Ø¹Ù‰ Ø¹Ù†Ø¯ Ø£ÙŠ Ø¥Ø¶Ø§ÙØ©/ØªØ¹Ø¯ÙŠÙ„/Ø­Ø°Ù Ù…Ù† Ø£ÙŠ Ø¬Ù‡Ø§Ø².
 */
export function onTablesChange(tables, onChange) {
  const name = `sync-${tables.join('-')}-${Math.random().toString(36).slice(2, 8)}`;
  const channel = supabase.channel(name);
  for (const table of tables) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      onChange
    );
  }
  channel.subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
