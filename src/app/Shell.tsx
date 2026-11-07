import { Outlet } from 'react-router';
import LeftNav from './LeftNav.tsx';
import TopBar from './TopBar.tsx';
import Footer from './Footer.tsx';
import { PresenterHost } from '../presenter/PresenterHost.tsx';

export default function Shell() {
  return (
    <div className="grid h-full grid-cols-[232px_1fr] bg-bg text-text">
      <LeftNav />
      <div className="grid min-h-0 min-w-0 grid-rows-[56px_1fr_32px]">
        <TopBar />
        <main className="min-h-0 overflow-auto p-6">
          <Outlet />
        </main>
        <Footer />
      </div>
      <PresenterHost />
    </div>
  );
}
