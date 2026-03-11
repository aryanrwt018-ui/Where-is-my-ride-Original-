import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";

const STARS = Array.from({ length: 80 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: Math.random() * 1.2 + 0.2,
}));

function drawStars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  globeRadius: number
) {
  const cx = width / 2;
  const cy = height / 2;

  STARS.forEach((s) => {
    const x = s.x * width;
    const y = s.y * height;

    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

    if (dist < globeRadius + 5) return;

    ctx.beginPath();
    ctx.arc(x, y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fill();
  });
}

export default function Globe3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    let width = canvas.clientWidth;
    let height = canvas.clientHeight;

    canvas.width = width;
    canvas.height = height;

    const radius = Math.min(width, height) / 2.2;

    const projection = geoOrthographic()
      .scale(radius)
      .translate([width / 2, height / 2])
      .clipAngle(90);

    const path = geoPath(projection, ctx);

    let rotation = 0;

    function drawOcean() {
      ctx.beginPath();
      path({ type: "Sphere" } as any);
      ctx.fillStyle = "#0b1d3a";
      ctx.fill();
    }

    function drawAtmosphere() {
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        radius,
        width / 2,
        height / 2,
        radius * 1.2
      );

      gradient.addColorStop(0, "rgba(80,150,255,0.3)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");

      ctx.beginPath();
      ctx.arc(width / 2, height / 2, radius * 1.2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    function drawGrid() {
      const graticule = d3.geoGraticule10();

      ctx.beginPath();
      path(graticule);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = "#000814";
      ctx.fillRect(0, 0, width, height);

      drawStars(ctx, width, height, radius);

      projection.rotate([rotation, -15]);

      drawOcean();
      drawGrid();
      drawAtmosphere();

      rotation += 0.05;

      requestAnimationFrame(draw);
    }

    draw();

    function resize() {
      width = canvas.clientWidth;
      height = canvas.clientHeight;

      canvas.width = width;
      canvas.height = height;

      projection.translate([width / 2, height / 2]).scale(
        Math.min(width, height) / 2.2
      );
    }

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}