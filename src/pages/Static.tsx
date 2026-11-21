import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Mail, MessageCircle, Music2, Youtube } from 'lucide-react';
import { CONTACT_EMAIL, DEV, SOCIALS } from '../lib/constants';

export function About() {
  return (
    <div className="page max-w-3xl">
      <h1 className="text-3xl font-extrabold">About <span className="grad-text">STARR FLIX</span></h1>
      <p className="mt-1 font-semibold">Entertainment without limits.</p>
      <div className="card mt-5 space-y-3 p-5 text-sm leading-relaxed text-muted">
        <p>STARR FLIX is an all-in-one entertainment platform that brings short dramas from DramaBox, live international TV channels, movies and sports channels, and TV guides into one fast, beautiful experience.</p>
        <p>Content is loaded live from third-party APIs. STARR FLIX does not host or modify any streams; availability, quality and licensing are determined by each provider, and we only use stream URLs those APIs supply.</p>
        <p>Your watchlist, history, continue-watching and preferences are stored privately in your own browser.</p>
      </div>
      <h2 className="h-title mt-8">An Entertainment Platform by {DEV}</h2>
      <p className="mt-2 text-sm text-muted">{DEV} designs and builds modern web and mobile products. STARR FLIX is developed and powered by {DEV}.</p>
      <div className="mt-4 flex gap-2"><Link to="/contact" className="btn-primary">Contact us</Link><Link to="/live" className="btn-ghost">Start watching</Link></div>
    </div>
  );
}

export function Contact() {
  const [f, setF] = useState({ name: '', email: '', message: '' });
  const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`STARR FLIX enquiry from ${f.name || 'a visitor'}`)}&body=${encodeURIComponent(`${f.message}\n\n— ${f.name} (${f.email})`)}`;
  const ok = f.name.trim() && /\S+@\S+\.\S+/.test(f.email) && f.message.trim();
  const socials = [
    { href: SOCIALS.whatsapp, label: 'WhatsApp', icon: MessageCircle }, { href: SOCIALS.youtube, label: 'YouTube', icon: Youtube },
    { href: SOCIALS.tiktok, label: 'TikTok', icon: Music2 }, { href: SOCIALS.facebook, label: 'Facebook', icon: Facebook }, { href: SOCIALS.instagram, label: 'Instagram', icon: Instagram },
  ];
  return (
    <div className="page max-w-4xl">
      <h1 className="text-3xl font-extrabold">Contact <span className="grad-text">us</span></h1>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <form className="card space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); if (ok) window.location.href = href; }}>
          <input className="input" placeholder="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          <input className="input" type="email" placeholder="Your email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
          <textarea className="input min-h-32" placeholder="How can we help?" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} required />
          <button className="btn-primary w-full" disabled={!ok}><Mail size={16} /> Send via email app</button>
          <p className="text-xs text-muted">This opens your email app with the message ready to send to {CONTACT_EMAIL}.</p>
        </form>
        <div className="card space-y-3 p-5">
          <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 hover:text-brand"><Mail size={18} /> {CONTACT_EMAIL}</a>
          {socials.map((s) => <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-brand"><s.icon size={18} /> {s.label}</a>)}
        </div>
      </div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="page grid min-h-[50vh] place-items-center text-center">
      <div><div className="text-6xl font-extrabold grad-text">404</div><p className="mt-2 text-muted">That page doesn&apos;t exist.</p><Link to="/" className="btn-primary mt-4">Back home</Link></div>
    </div>
  );
}
