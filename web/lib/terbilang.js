// Konversi angka Rupiah ke kata (Bahasa Indonesia). Contoh: 150000 -> "seratus lima puluh ribu rupiah"
const satuan = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

function toWords(n) {
  n = Math.floor(Math.abs(n));
  if (n < 12) return satuan[n];
  if (n < 20) return toWords(n - 10) + " belas";
  if (n < 100) return toWords(Math.floor(n / 10)) + " puluh" + (n % 10 ? " " + toWords(n % 10) : "");
  if (n < 200) return "seratus" + (n % 100 ? " " + toWords(n % 100) : "");
  if (n < 1000) return toWords(Math.floor(n / 100)) + " ratus" + (n % 100 ? " " + toWords(n % 100) : "");
  if (n < 2000) return "seribu" + (n % 1000 ? " " + toWords(n % 1000) : "");
  if (n < 1000000) return toWords(Math.floor(n / 1000)) + " ribu" + (n % 1000 ? " " + toWords(n % 1000) : "");
  if (n < 1000000000) return toWords(Math.floor(n / 1000000)) + " juta" + (n % 1000000 ? " " + toWords(n % 1000000) : "");
  if (n < 1000000000000) return toWords(Math.floor(n / 1000000000)) + " miliar" + (n % 1000000000 ? " " + toWords(n % 1000000000) : "");
  return toWords(Math.floor(n / 1000000000000)) + " triliun" + (n % 1000000000000 ? " " + toWords(n % 1000000000000) : "");
}

export function terbilang(n) {
  const num = Math.floor(Math.abs(Number(n) || 0));
  if (num === 0) return "nol rupiah";
  const words = toWords(num).replace(/\s+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1) + " rupiah";
}
