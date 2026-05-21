import { Linkedin, Search } from 'lucide-react';
import SlideLayout from '../SlideLayout';
import troels from '@/assets/team-troels.jpg';
import johannes from '@/assets/team-johannes.jpg';
import simon from '@/assets/team-simon.jpg';

const team = [
  {
    photo: troels,
    name: 'Troels Enigk',
    role: 'AI, Automation & Product',
    bg: 'Founders Associate · Siemens Advanta · Eraneos · Getsafe',
    edu: 'Católica Lisbon',
    linkedin: 'https://www.linkedin.com/in/troels-enigk/',
  },
  {
    photo: johannes,
    name: 'Johannes Stopa',
    role: 'E-Commerce Strategy & BD',
    bg: 'Founders Associate E-Com · Detecon · FUNKE · Holzrichter',
    edu: 'Católica Lisbon · WU Vienna',
    linkedin: 'https://www.linkedin.com/in/johannes-stopa/?locale=en',
  },
  {
    photo: simon,
    name: 'Simon Mackeprang',
    role: 'Operations & Software Dev',
    bg: 'Own E-Com shop · KPMG · Ops Manager A352 · EbelHofer',
    edu: 'Católica Lisbon · HEC Montreal',
    linkedin: 'https://www.linkedin.com/in/simon-mackeprang/',
  },
];

const Slide13Ask = ({ active }: { active: boolean }) => (
  <SlideLayout className="items-center">
    <h2 className={`text-3xl md:text-5xl font-bold mb-10 text-center transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      Meet our <span className="text-primary">team.</span>
    </h2>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl w-full mb-8">
      {team.map((m, i) => (
        <div
          key={i}
          className={`rounded-xl border border-border bg-card p-5 text-center transition-all duration-700 ${active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          style={{ transitionDelay: `${200 + i * 150}ms` }}
        >
          <img
            src={m.photo}
            alt={m.name}
            className="w-24 h-24 rounded-full object-cover mx-auto mb-3 border-2 border-primary/30"
          />
          <h3 className="font-bold text-base">{m.name}</h3>
          <div className="text-xs text-primary font-medium italic mb-2">{m.role}</div>
          <p className="text-[11px] text-muted-foreground leading-snug">{m.bg}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">{m.edu}</p>
          <a
            href={m.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${m.name} on LinkedIn`}
            className="inline-block mt-3"
          >
            <Linkedin size={14} className="text-muted-foreground hover:text-primary cursor-pointer mx-auto" />
          </a>
        </div>
      ))}
    </div>

    <div className={`flex items-center gap-2 text-xs text-muted-foreground transition-all duration-700 delay-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
      <Search size={14} className="text-primary" />
      <span>Looking for: <span className="text-foreground font-medium">technical co-founder (ML/CV)</span> · <span className="text-foreground font-medium">retail-tech mentor</span></span>
    </div>
  </SlideLayout>
);

export default Slide13Ask;
