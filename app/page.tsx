import Image from "next/image";

import { HelloButton, NavTabs } from "@/components";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center min-h-0 bg-zinc-50 font-sans dark:bg-black">
      <NavTabs />
    </div>
  );
}
