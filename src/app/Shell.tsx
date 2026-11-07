import { Outlet } from 'react-router';
import LeftNav from './LeftNav.tsx';
import TopBar from './TopBar.tsx';
import Footer from './Footer.tsx';
import { PresenterHost } from '../presenter/PresenterHost.tsx';
import { GuidePanel } from './GuidePanel.tsx';

export default function Shell() {
  return (
    <div className="grid h-full grid-cols-[248px_1fr] bg-bg text-text">
      <LeftNav />
      <div className="grid min-h-0 min-w-0 grid-rows-[64px_1fr_32px]">
        <TopBar />
        <main className="min-h-0 overflow-auto p-6 [@media(max-height:820px)]:p-4">
          <Outlet />
        </main>
        <Footer />
      </div>
      <PresenterHost />
      <GuidePanel />
    </div>
  );
}
