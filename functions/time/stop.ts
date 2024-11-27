export async function stopTimeTracking(userId: string): Promise<Response> {
  const kv = await Deno.openKv();
  
  // Get the active time entry
  const activeEntry = await kv.get(['users', userId, 'activeTimeEntry']);
  if (!activeEntry.value) {
    return new Response('No active time entry found', { status: 404 });
  }

  const timeEntry = activeEntry.value;
  timeEntry.endTime = new Date();

  // Update the time entry and remove the active entry
  await kv.atomic()
    .set(['users', userId, 'timeEntries', timeEntry.id], timeEntry)
    .delete(['users', userId, 'activeTimeEntry'])
    .commit();

  return new Response(JSON.stringify(timeEntry), {
    headers: { 'Content-Type': 'application/json' }
  });
}
