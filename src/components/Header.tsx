import { Link, useNavigate } from "@tanstack/react-router";
import { Heart, MessageCircle, PlusCircle, Search, Store, User as UserIcon, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex h-16 items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[color:var(--ss-green)] text-primary-foreground">
            <Store className="h-5 w-5" />
          </span>
          <span className="hidden sm:inline">
            <span className="text-[color:var(--ss-green)]">souq</span>
            <span className="text-[color:var(--ss-blue)]">ss</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Link to="/" className="hidden md:inline-flex">
            <Button variant="ghost" size="sm">
              <Search className="mr-2 h-4 w-4" /> Browse
            </Button>
          </Link>
          {user ? (
            <>
              <Link to="/favorites" className="hidden sm:inline-flex">
                <Button variant="ghost" size="icon" aria-label="Favorites">
                  <Heart className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/messages">
                <Button variant="ghost" size="icon" aria-label="Messages">
                  <MessageCircle className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/sell">
                <Button size="sm" className="bg-[color:var(--ss-gold)] text-[color:var(--accent-foreground)] hover:opacity-90">
                  <PlusCircle className="mr-2 h-4 w-4" /> Sell
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Account">
                    <UserIcon className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate({ to: "/my-listings" })}>
                    My listings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/favorites" })}>
                    Favorites
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/messages" })}>
                    Messages
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => {
                      await signOut();
                      navigate({ to: "/" });
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link to="/sell">
                <Button size="sm" className="bg-[color:var(--ss-gold)] text-[color:var(--accent-foreground)] hover:opacity-90">
                  <PlusCircle className="mr-2 h-4 w-4" /> Sell
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}