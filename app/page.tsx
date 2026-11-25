import { readWorkspaceState } from '@/lib/persistence';
import GrabAutomationWorkbench from '@/components/GrabAutomationWorkbench';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const initialState = await readWorkspaceState();
  return <GrabAutomationWorkbench initialState={initialState} />;
}
