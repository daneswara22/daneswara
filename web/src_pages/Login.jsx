import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiError } from "@/lib/api";
import { Store, Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/app");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left visual */}
      <div className="relative hidden lg:block">
        <img
          src="https://images.unsplash.com/photo-1726137569911-bc03e55fd87f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400"
          alt="Kasir modern"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-blue-950/70" />
        <div className="absolute bottom-0 p-12 text-white">
          <div className="mb-4 flex h-16 w-16 items-center justify-center">
            <img src="/logo.png" alt="Daneswara POS" className="h-full w-full object-contain" />
          </div>
          <h1 className="font-display text-4xl font-black leading-tight tracking-tight">
            Daneswara POS
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Kelola penjualan, stok, dan laporan bisnis Anda secara real-time dari mana saja.
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center">
              <img src="/logo.png" alt="Daneswara POS" className="h-full w-full object-contain" />
            </div>
            <span className="font-display text-lg font-bold">Daneswara POS</span>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Masuk</p>
          <h2 className="mt-1 font-display text-3xl font-bold tracking-tight">Selamat datang kembali</h2>
          <p className="mt-2 text-sm text-muted-foreground">Masukkan kredensial akun Anda untuk melanjutkan.</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                data-testid="login-username-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                className="h-12"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                data-testid="login-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                className="h-12"
                required
              />
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="login-error">
                {error}
              </p>
            )}
            <Button type="submit" className="h-12 w-full text-base font-semibold" disabled={loading} data-testid="login-submit-button">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Masuk"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
