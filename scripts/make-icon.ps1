# make-icon.ps1 - builds the app icons from icon\file manager icon.jpg.
#   icon\app.ico          exe icon (16-256 px), used by the packager's --icon
#   src\renderer\icon.png window icon and sidebar logo (256 px)
# The JPG has a white background; it is made transparent by a flood fill from the edges,
# so the white paper inside the folder stays opaque. Run: powershell -File scripts\make-icon.ps1
param([string]$Src = "$PSScriptRoot\..\icon\file manager icon.jpg")
$ErrorActionPreference = 'Stop'
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Drawing2D;
using System.Drawing.Imaging; using System.IO; using System.Runtime.InteropServices;
public static class IconMaker {
  // Background = pixels joined to the border that are within T of white. Their alpha grows with the
  // distance from white, and the colour is un-blended from white, so anti-aliased edges stay smooth.
  public static Bitmap Cutout(Bitmap src, int T) {
    int w = src.Width, h = src.Height;
    var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(bmp)) g.DrawImage(src, 0, 0, w, h);
    var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    var px = new byte[w * h * 4]; Marshal.Copy(data.Scan0, px, 0, px.Length);
    Func<int, int> dist = i => 255 - Math.Min(px[i], Math.Min(px[i + 1], px[i + 2]));
    var seen = new bool[w * h]; var q = new Queue<int>();
    for (int x = 0; x < w; x++) { q.Enqueue(x); q.Enqueue((h - 1) * w + x); }
    for (int y = 0; y < h; y++) { q.Enqueue(y * w); q.Enqueue(y * w + w - 1); }
    while (q.Count > 0) {
      int p = q.Dequeue(); if (seen[p]) continue;
      int i = p * 4, d = dist(i); if (d >= T) continue;
      seen[p] = true;
      double a = Math.Max(0, Math.Min(1, (d - 8) / (double)(T - 8)));
      for (int c = 0; c < 3; c++) px[i + c] = (byte)(a <= 0 ? 0 : Math.Max(0, Math.Min(255, (px[i + c] - (1 - a) * 255) / a)));
      px[i + 3] = (byte)Math.Round(a * 255);
      int x0 = p % w, y0 = p / w;
      if (x0 > 0) q.Enqueue(p - 1); if (x0 < w - 1) q.Enqueue(p + 1);
      if (y0 > 0) q.Enqueue(p - w); if (y0 < h - 1) q.Enqueue(p + w);
    }
    Marshal.Copy(px, 0, data.Scan0, px.Length); bmp.UnlockBits(data);
    return bmp;
  }
  public static byte[] Png(Bitmap src, int size) {
    using (var b = new Bitmap(size, size, PixelFormat.Format32bppArgb)) {
      using (var g = Graphics.FromImage(b)) {
        g.InterpolationMode = InterpolationMode.HighQualityBicubic; g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.CompositingMode = CompositingMode.SourceCopy;
        using (var wrap = new ImageAttributes()) { wrap.SetWrapMode(WrapMode.TileFlipXY);
          g.DrawImage(src, new Rectangle(0, 0, size, size), 0, 0, src.Width, src.Height, GraphicsUnit.Pixel, wrap); }
      }
      using (var ms = new MemoryStream()) { b.Save(ms, ImageFormat.Png); return ms.ToArray(); }
    }
  }
  // ICO with PNG-compressed entries (supported since Windows Vista).
  public static void Ico(Bitmap src, int[] sizes, string path) {
    var pngs = new List<byte[]>(); foreach (var s in sizes) pngs.Add(Png(src, s));
    using (var f = new BinaryWriter(File.Create(path))) {
      f.Write((short)0); f.Write((short)1); f.Write((short)sizes.Length);
      int offset = 6 + 16 * sizes.Length;
      for (int k = 0; k < sizes.Length; k++) {
        f.Write((byte)(sizes[k] >= 256 ? 0 : sizes[k])); f.Write((byte)(sizes[k] >= 256 ? 0 : sizes[k]));
        f.Write((byte)0); f.Write((byte)0); f.Write((short)1); f.Write((short)32);
        f.Write(pngs[k].Length); f.Write(offset); offset += pngs[k].Length;
      }
      foreach (var p in pngs) f.Write(p);
    }
  }
  // Images stay inside C#: PowerShell 5.1 cannot pass a Bitmap to an Add-Type method.
  public static void Build(string jpg, string ico, string png) {
    using (var src = new Bitmap(jpg)) using (var cut = Cutout(src, 60)) {
      Ico(cut, new[] { 16, 24, 32, 48, 64, 128, 256 }, ico);
      File.WriteAllBytes(png, Png(cut, 256));
    }
  }
}
'@
$root = (Resolve-Path "$PSScriptRoot\..").Path
[IconMaker]::Build((Resolve-Path $Src).Path, "$root\icon\app.ico", "$root\src\renderer\icon.png")
"wrote icon\app.ico and src\renderer\icon.png"
