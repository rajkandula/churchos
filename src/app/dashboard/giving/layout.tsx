import { AppGate } from "@/components/AppGate";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppGate app="giving">{children}</AppGate>;
}
