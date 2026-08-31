import Link from "next/link";

import { ModeToggle } from "./mode-toggle";

export default function Header() {
  return (
    <header>
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 sm:px-6 lg:px-6">
        <Link className="font-bold text-2xl tracking-tighter" href="/">
          Toolora
        </Link>
        <ModeToggle />
      </div>
    </header>
  );
}
