import { forwardRef, useImperativeHandle, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { useLang } from "@/components/landing/i18n/LangContext";

const PACKAGES = ["screen", "dtg", "bulk"];

export const QuoteForm = forwardRef(function QuoteForm(_, ref) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    package: "screen",
    quantity: 50,
    description: "",
    artwork_url: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useImperativeHandle(ref, () => ({
    setPackage: (pkg) => {
      if (PACKAGES.includes(pkg)) setForm((f) => ({ ...f, package: pkg }));
    },
  }));

  const update = (k) => (e) => {
    const v = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = t("f_required");
    if (!form.email.trim()) e.email = t("f_required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email";
    if (!form.description.trim()) e.description = t("f_required");
    if (!form.quantity || form.quantity < 1) e.quantity = t("f_required");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("email", form.email);
      fd.append("phone", form.phone || "-");
      fd.append("package", form.package);
      fd.append("quantity", String(form.quantity));
      fd.append("description", form.description);
      fd.append("artwork_url", form.artwork_url || "-");
      fd.append("_subject", `New quote — ${form.name} (${form.package})`);
      fd.append("_template", "table");
      fd.append("_captcha", "false");
      const res = await fetch("https://formsubmit.co/ajax/daneswara.made@gmail.com", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd,
      });
      if (!res.ok) throw new Error("Network error");
      toast.success(t("f_success"));
      setForm({
        name: "",
        email: "",
        phone: "",
        package: "screen",
        quantity: 50,
        description: "",
        artwork_url: "",
      });
    } catch (err) {
      toast.error(t("f_error"));
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-background border-2 border-foreground px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background";
  const labelCls =
    "block text-[11px] font-bold uppercase tracking-[0.2em] mb-1.5";

  const pkgOptions = [
    { v: "screen", l: t("pkg_screen_t") },
    { v: "dtg", l: t("pkg_dtg_t") },
    { v: "bulk", l: t("pkg_bulk_t") },
  ];

  return (
    <section
      id="quote"
      data-testid="quote-section"
      className="border-b-2 border-foreground"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 py-16 sm:py-24 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5">
          <div className="text-xs uppercase tracking-[0.3em] text-primary font-bold">
            ★ {t("quote_eyebrow")} ★
          </div>
          <h2 className="font-display mt-3 text-4xl sm:text-5xl lg:text-6xl uppercase tracking-wider leading-none">
            {t("quote_title")}
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-md">
            {t("quote_sub")}
          </p>

          <div className="mt-8 bg-card border-2 border-foreground p-5 shadow-stamp">
            <div className="font-script text-2xl text-primary leading-none">store hours</div>
            <div className="mt-2 text-sm uppercase tracking-widest">Mon — Sat · 10:00 AM — 7:00 PM</div>
            <div className="mt-3 text-sm">daneswara.made@gmail.com</div>
            <div className="text-sm">+62 858 8810 2930</div>
          </div>
        </div>

        <form
          data-testid="quote-form"
          onSubmit={submit}
          className="lg:col-span-7 bg-card border-2 border-foreground p-6 sm:p-8 shadow-stamp-lg"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="qf-name">{t("f_name")}</label>
              <input
                id="qf-name"
                data-testid="qf-name"
                className={inputCls}
                value={form.name}
                onChange={update("name")}
                placeholder="Jane Doe"
              />
              {errors.name && <div className="mt-1 text-xs text-destructive">{errors.name}</div>}
            </div>
            <div>
              <label className={labelCls} htmlFor="qf-email">{t("f_email")}</label>
              <input
                id="qf-email"
                data-testid="qf-email"
                type="email"
                className={inputCls}
                value={form.email}
                onChange={update("email")}
                placeholder="jane@studio.com"
              />
              {errors.email && <div className="mt-1 text-xs text-destructive">{errors.email}</div>}
            </div>
            <div>
              <label className={labelCls} htmlFor="qf-phone">{t("f_phone")}</label>
              <input
                id="qf-phone"
                data-testid="qf-phone"
                className={inputCls}
                value={form.phone}
                onChange={update("phone")}
                placeholder="+62 ..."
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="qf-quantity">{t("f_quantity")}</label>
              <input
                id="qf-quantity"
                data-testid="qf-quantity"
                type="number"
                min={1}
                className={inputCls}
                value={form.quantity}
                onChange={update("quantity")}
              />
              {errors.quantity && (
                <div className="mt-1 text-xs text-destructive">{errors.quantity}</div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="qf-package">{t("f_package")}</label>
              <div className="grid grid-cols-3 gap-2">
                {pkgOptions.map((o) => (
                  <button
                    type="button"
                    key={o.v}
                    data-testid={`qf-pkg-${o.v}`}
                    onClick={() => setForm((f) => ({ ...f, package: o.v }))}
                    className={`px-3 py-2.5 border-2 border-foreground text-xs uppercase tracking-wider font-bold ${
                      form.package === o.v
                        ? "bg-foreground text-background"
                        : "bg-background"
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="qf-description">{t("f_description")}</label>
              <textarea
                id="qf-description"
                data-testid="qf-description"
                rows={4}
                className={inputCls}
                value={form.description}
                onChange={update("description")}
                placeholder="Tell us the vibe, colors, deadlines…"
              />
              {errors.description && (
                <div className="mt-1 text-xs text-destructive">{errors.description}</div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="qf-artwork">{t("f_artwork")}</label>
              <input
                id="qf-artwork"
                data-testid="qf-artwork"
                className={inputCls}
                value={form.artwork_url}
                onChange={update("artwork_url")}
                placeholder="https://drive.google.com/…"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            data-testid="qf-submit"
            className="mt-6 inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 border-2 border-foreground shadow-stamp font-bold uppercase tracking-wider text-sm lift disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? t("f_sending") : t("f_submit")} <Send size={16} />
          </button>
        </form>
      </div>
    </section>
  );
});
