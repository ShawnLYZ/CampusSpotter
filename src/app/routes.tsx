import { createBrowserRouter } from 'react-router';
import Shell from './Shell.tsx';
import CommandCenterPage from '../pages/command-center/CommandCenterPage.tsx';
import EarlyWarningPage from '../pages/early-warning/EarlyWarningPage.tsx';
import ScenarioLabPage from '../pages/scenario-lab/ScenarioLabPage.tsx';
import ActionPlansPage from '../pages/action-plans/ActionPlansPage.tsx';
import DecisionLogPage from '../pages/action-plans/DecisionLogPage.tsx';
import ReplayPage from '../pages/replay/ReplayPage.tsx';
import DataAssumptionsPage from '../pages/data-assumptions/DataAssumptionsPage.tsx';

// /login is added in P9.
export const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <CommandCenterPage /> },
      { path: '/early-warning', element: <EarlyWarningPage /> },
      { path: '/scenario-lab', element: <ScenarioLabPage /> },
      { path: '/action-plans', element: <ActionPlansPage /> },
      { path: '/action-plans/log', element: <DecisionLogPage /> },
      { path: '/replay', element: <ReplayPage /> },
      { path: '/data', element: <DataAssumptionsPage /> },
    ],
  },
]);
