export async function startTimeTracking(userId: string): Promise<Response> {
  const kv = await Deno.openKv();
  
  const timeEntry = {
    id: crypto.randomUUID(),
    userId,
    startTime: new Date(),
    endTime: null,
    description: '',
    tags: [],
    rate: 0
  };

  // Store the active time entry
  await kv.atomic()
    .set(['users', userId, 'activeTimeEntry'], timeEntry)
    .set(['users', userId, 'timeEntries', timeEntry.id], timeEntry)
    .commit();

  return new Response(JSON.stringify(timeEntry), {
    headers: { 'Content-Type': 'application/json' }
  });
}
