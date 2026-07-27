import { ArrowRight, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface GlobalAskProps {
  activeSeason: number;
}

const GlobalAsk = ({ activeSeason }: GlobalAskProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');

  if (location.pathname === '/ask') return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = question.trim();
    const params = new URLSearchParams({ season: String(activeSeason) });
    if (value) params.set('q', value);
    navigate(`/ask?${params.toString()}`);
  };

  return (
    <aside className="slip-global-ask" aria-label="Ask Slipstream">
      <form onSubmit={submit} role="search">
        <Search aria-hidden="true" size={16} />
        <label htmlFor="global-ask-question">Ask F1 driver stats</label>
        <input
          id="global-ask-question"
          maxLength={220}
          placeholder="Who has the most wins?"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button aria-label="Open Ask Slipstream" type="submit">
          <ArrowRight aria-hidden="true" size={16} />
        </button>
      </form>
    </aside>
  );
};

export default GlobalAsk;
