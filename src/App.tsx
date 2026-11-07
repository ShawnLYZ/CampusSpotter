import { RouterProvider } from 'react-router';
import { ProviderRoot } from './app/ProviderContext.tsx';
import { router } from './app/routes.tsx';

export default function App() {
  return (
    <ProviderRoot>
      <RouterProvider router={router} />
    </ProviderRoot>
  );
}
