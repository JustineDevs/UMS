import { type FormEvent, type ReactNode } from 'react';
import { motion, type Variants } from 'framer-motion';
import {
  FaArrowRight,
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaXTwitter,
} from 'react-icons/fa6';

function LogoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-label="Universal Music Store" className={className} role="img">
      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M28 57c7 7 13 10 22 10s15-3 22-10M35 42h30M50 24v42" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

interface Footer12Link {
  label: string;
  href: string;
}

interface Footer12Column {
  title: string;
  links: Footer12Link[];
}

interface Footer12SocialLink {
  label: string;
  href: string;
  icon: ReactNode;
}

export interface Footer12Props {
  newsletterTitle?: string;
  inputPlaceholder?: string;
  subscribeText?: string;
  onSubscribe?: (email: string) => void;
  columns?: Footer12Column[];
  brandName?: string;
  brandImageSrc?: string;
  copyright?: string;
  socialLinks?: Footer12SocialLink[];
}

const columnsDefault: Footer12Column[] = [
  {
    title: 'SOLUTIONS',
    links: [
      { label: 'Transactional Emails', href: '#' },
      { label: 'Marketing Emails', href: '#' },
      { label: 'Email Automation', href: '#' },
      { label: 'Email Builder', href: '#' },
      { label: 'SMTP', href: '#' },
    ],
  },
  {
    title: 'DOCS',
    links: [
      { label: 'Getting Started', href: '#' },
      { label: 'API Reference', href: '#' },
      { label: 'Guides', href: '#' },
      { label: 'Transactional Emails', href: '#' },
    ],
  },
  {
    title: 'RESOURCES',
    links: [
      { label: 'FAQ', href: '#' },
      { label: 'Blog', href: '#' },
      { label: 'Glossary', href: '#' },
      { label: 'Changelog', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Fair Use', href: '#' },
      { label: 'Terms & Conditions', href: '#' },
      { label: 'Subprocessors', href: '#' },
      { label: 'Privacy Policy', href: '#' },
    ],
  },
];

const socialLinksDefault: Footer12SocialLink[] = [
  { label: 'Facebook', href: '#', icon: <FaFacebookF /> },
  { label: 'X', href: '#', icon: <FaXTwitter /> },
  { label: 'Instagram', href: '#', icon: <FaInstagram /> },
  { label: 'LinkedIn', href: '#', icon: <FaLinkedinIn /> },
];

const footerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.1,
    },
  },
};

const riseItem: Variants = {
  hidden: { opacity: 0, y: 20, filter: 'blur(10px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', duration: 0.65, bounce: 0 },
  },
};

const brandItem: Variants = {
  hidden: { opacity: 0, y: 28, filter: 'blur(12px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', duration: 0.85, bounce: 0 },
  },
};


export function Footer12({
  newsletterTitle = 'Keep up to date with our quarterly newsletter, "You’ve got mail."',
  inputPlaceholder = 'Enter Your Email',
  subscribeText = 'Subscribe',
  onSubscribe,
  columns = columnsDefault,
  brandName = 'Universal Music Store',
  brandImageSrc,
  copyright = '© 2026 Universal Music Store. All rights reserved.',
  socialLinks = socialLinksDefault,
}: Footer12Props) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');
    onSubscribe?.(email);
  }

  return (
    <motion.footer
      variants={footerContainer}
      initial={false}
      whileInView="visible"
      viewport={{ once: true, amount: 0.28 }}
      className="w-full overflow-hidden bg-white px-6 py-10 font-sans text-neutral-900 antialiased sm:px-10 lg:px-12"
    >
      <div className="mx-auto flex min-h-[390px] w-full max-w-[1440px] flex-col justify-between">
        <div className="grid gap-10 lg:grid-cols-[minmax(250px,390px)_1fr] lg:gap-20">
          <motion.div initial={false} variants={riseItem} className="max-w-[390px]">
            <h2 className="max-w-[330px] text-[18px] leading-[1.08] font-normal tracking-normal text-neutral-900 sm:text-[19px]">
              {newsletterTitle}
            </h2>

            <form onSubmit={handleSubmit} className="mt-6 max-w-[390px]">
              <input
                name="email"
                type="email"
                aria-label="Email address"
                required
                placeholder={inputPlaceholder}
                className="h-[50px] w-full rounded-md bg-stone-300 px-6 text-sm font-normal text-neutral-950 outline outline-1 outline-black/10 transition-[background-color,outline-color] duration-200 placeholder:text-neutral-700 focus:bg-stone-100 focus:outline-white/40"
              />

              <motion.button
                type="submit"
                whileTap={{ scale: 0.96 }}
                className="text-md mt-5 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-white px-5 font-medium text-neutral-950 shadow-[inset_0px_2px_2px_1px_rgba(255,255,255,1),inset_0_-2px_2px_1px_rgba(0,0,0,0.1)] outline-2 outline-stone-200 transition-[background-color,transform] duration-200 hover:bg-stone-50 active:scale-[0.98]"
              >
                <span>{subscribeText}</span>
                <FaArrowRight className="size-4" />
              </motion.button>
            </form>
          </motion.div>

          <motion.nav
            initial={false}
            variants={footerContainer}
            aria-label="Footer navigation"
            className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-4 lg:pt-0"
          >
            {columns.map((column) => (
              <motion.div key={column.title} initial={false} variants={riseItem}>
                <h3 className="text-lg leading-none font-normal tracking-wide text-neutral-900 uppercase">
                  {column.title}
                </h3>
                <ul className="mt-5 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm leading-none font-light tracking-wide text-neutral-700 transition-colors duration-200 hover:text-black"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.nav>
        </div>

        <motion.div
          initial={false}
          variants={brandItem}
          className="mx-auto mt-12 flex w-full items-center justify-center  overflow-hidden sm:mt-8 lg:mt-4"
        >
          {brandImageSrc ? (
            <img src={brandImageSrc} alt={brandName} className="h-auto w-full max-w-4xl object-contain" />
          ) : (
            <div className="flex items-center gap-4 text-3xl font-semibold tracking-tight text-neutral-900">
              <LogoIcon className="size-20" />
              {brandName}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={false}
          variants={riseItem}
          className="mt-9 grid gap-6 text-neutral-900 md:grid-cols-2 md:items-center"
        >
          <p className="text-md leading-none font-light text-neutral-600">
            {copyright}
          </p>

          <div className="flex items-center gap-5 md:justify-end">
            {socialLinks.map((link) => (
              <motion.a
                key={link.label}
                href={link.href}
                aria-label={link.label}
                whileTap={{ scale: 0.96 }}
                className="flex min-h-10 min-w-10 items-center justify-center text-neutral-700 transition-colors duration-200 hover:text-black md:min-h-6 md:min-w-6"
              >
                <span className="md:text-md text-base">{link.icon}</span>
              </motion.a>
            ))}
          </div>

        </motion.div>
      </div>
    </motion.footer>
  );
}
