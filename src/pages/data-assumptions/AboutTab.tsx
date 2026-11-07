import { Link } from 'react-router';

const CARDS = [
  { title: 'AI Research Intelligence & Trend Analysis', to: '/early-warning', link: 'Open Early Warning',
    text: 'Gemini event scanning, daily risk trends and the weekly Friday pattern.' },
  { title: 'Research Data Analysis & Visualisation Assistant', to: '/scenario-lab', link: 'Open Scenario Lab',
    text: 'The 3D campus, small charts, provenance-labelled data and plain-English Gemini Q&A.' },
  { title: 'Predictive Research & Resource Planning', to: '/action-plans', link: 'Open Action Plans',
    text: 'The forecast engine, levers, budget-constrained action plans and the Decision Log.' },
];

export function AboutTab() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {CARDS.map((c) => (
        <article key={c.title} className="flex flex-col card p-5">
          <h2 className="text-lg font-medium text-text">{c.title}</h2>
          <p className="mt-2 flex-1 text-sm text-text-2">{c.text}</p>
          <Link to={c.to} className="btn mt-4 self-start">{c.link}</Link>
        </article>
      ))}
    </div>
  );
}
