"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/types";

export default function Header() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function getProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        setProfile(data);
      }
      setLoading(false);
    }

    getProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      getProfile();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setProfile(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-bold">
          Tominh
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/products" className="text-sm hover:underline">
            Sản phẩm
          </Link>
          <Link href="/cart" className="text-sm hover:underline">
            Giỏ hàng
          </Link>

          {loading ? (
            <span className="h-8 w-20 animate-pulse rounded-md bg-gray-200 dark:bg-gray-800" />
          ) : profile ? (
            <>
              {profile.role === "admin" && (
                <Link
                  href="/dashboard"
                  className="text-sm font-medium hover:underline"
                >
                  Quản lý
                </Link>
              )}
              <Link href="/orders" className="text-sm hover:underline">
                Đơn hàng
              </Link>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {profile.full_name || "User"}
              </span>
              <button
                onClick={handleLogout}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                Đăng nhập
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-foreground px-3 py-1.5 text-sm text-background hover:opacity-90"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
