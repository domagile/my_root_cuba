import React from 'react';
import { useUIStore } from '../../stores/useUIStore';

export interface TreeOfLifeEmblemProps {
  className?: string;
  size?: number;
}

export const TreeOfLifeEmblem: React.FC<TreeOfLifeEmblemProps> = ({
  className = 'w-9 h-9',
  size,
}) => {
  const customEmblemImage = useUIStore((s) => s.customEmblemImage);
  const style = size ? { width: size, height: size } : undefined;

  // If user uploaded their custom image from their file (image.png), render it cleanly in the circle
  if (customEmblemImage) {
    return (
      <div
        className={`relative rounded-full overflow-hidden flex items-center justify-center ${className}`}
        style={style}
      >
        <img
          src={customEmblemImage}
          alt="Родовідне Дерево Життя (Тіні забутих предків)"
          className="w-full h-full object-contain rounded-full drop-shadow-sm select-none"
        />
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      style={style}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Родовідне Дерево Життя (Тіні забутих предків)"
    >
      <defs>
        {/* Soft 3D metallic drop shadow */}
        <filter id="pendant-tree-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000000" floodOpacity="0.45" />
        </filter>

        {/* Polished fine silver gradients */}
        <linearGradient id="silver-rim-grad" x1="15%" y1="10%" x2="85%" y2="90%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="25%" stopColor="#E2E8F0" />
          <stop offset="50%" stopColor="#94A3B8" />
          <stop offset="75%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>

        <linearGradient id="silver-tree-grad" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="20%" stopColor="#E2E8F0" />
          <stop offset="50%" stopColor="#94A3B8" />
          <stop offset="80%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>

        <linearGradient id="silver-leaves-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="40%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>
      </defs>

      <g filter="url(#pendant-tree-shadow)">
        {/* ======================================================== */}
        {/* 1. OUTER CIRCULAR SILVER RIM                            */}
        {/* ======================================================== */}
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke="url(#silver-rim-grad)"
          strokeWidth="6"
        />
        {/* Subtle inner bevel ring */}
        <circle
          cx="100"
          cy="100"
          r="89"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1"
          opacity="0.6"
          strokeDasharray="35 75"
        />

        {/* ======================================================== */}
        {/* 2. BASE AND SLENDER ORGANIC TRUNK                        */}
        {/* ======================================================== */}
        {/* Flared pedestal base merging with bottom circle arc */}
        <path
          d="M 52 178 
             C 66 182, 82 184, 100 184 
             C 118 184, 134 182, 148 178 
             C 136 166, 120 152, 107 136 
             C 107 122, 116 108, 120 92 
             C 116 94, 112 97, 108 102 
             C 105 106, 103 112, 100 118 
             C 97 112, 95 106, 92 102 
             C 88 97, 84 94, 80 92 
             C 84 108, 93 122, 93 136 
             C 80 152, 64 166, 52 178 Z"
          fill="url(#silver-tree-grad)"
        />

        {/* Highlight on center trunk */}
        <path
          d="M 100 182 C 100 166, 100 144, 100 125"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* ======================================================== */}
        {/* 3. TWIN UPRIGHT BOUGHS (Вертикальні вигнуті стовбури)     */}
        {/* ======================================================== */}
        <g stroke="url(#silver-tree-grad)" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Left curved central bough */}
          <path
            d="M 94 116 C 90 102, 84 88, 83 72 C 82 56, 86 40, 92 24 C 95 16, 98 11, 100 8"
            strokeWidth="3.8"
          />
          {/* Right curved central bough */}
          <path
            d="M 106 116 C 110 102, 116 88, 117 72 C 118 56, 114 40, 108 24 C 105 16, 102 11, 100 8"
            strokeWidth="3.8"
          />

          {/* Top connection seamlessly into top rim */}
          <path d="M 97 10 C 100 8, 100 8, 103 10" strokeWidth="4.5" />

          {/* ======================================================== */}
          {/* 4. LOWER DROOPING OAK BRANCHES                          */}
          {/* ======================================================== */}
          {/* Left drooping branch */}
          <path
            d="M 93 132 C 78 126, 58 126, 38 136 C 30 140, 26 150, 30 160"
            strokeWidth="4"
          />
          {/* Right drooping branch */}
          <path
            d="M 107 132 C 122 126, 142 126, 162 136 C 170 140, 174 150, 170 160"
            strokeWidth="4"
          />

          {/* Bottom stabilizing scrolls */}
          <path d="M 30 160 C 34 168, 44 172, 52 178" strokeWidth="2.8" />
          <path d="M 170 160 C 166 168, 156 172, 148 178" strokeWidth="2.8" />

          {/* ======================================================== */}
          {/* 5. ORGANIC CANOPY BRANCHES & SPIRAL FILIGREE            */}
          {/* ======================================================== */}
          {/* Left middle branches */}
          <path d="M 86 92 C 70 82, 50 82, 32 94 C 22 100, 18 110, 22 118" strokeWidth="3.2" />
          <path d="M 32 94 C 26 84, 30 72, 40 68 C 50 64, 58 74, 54 82" strokeWidth="2.4" />
          <path d="M 40 68 C 30 64, 22 72, 20 82" strokeWidth="2.2" />

          {/* Right middle branches */}
          <path d="M 114 92 C 130 82, 150 82, 168 94 C 178 100, 182 110, 178 118" strokeWidth="3.2" />
          <path d="M 168 94 C 174 84, 170 72, 160 68 C 150 64, 142 74, 146 82" strokeWidth="2.4" />
          <path d="M 160 68 C 170 64, 178 72, 180 82" strokeWidth="2.2" />

          {/* Upper left branches */}
          <path d="M 85 62 C 68 52, 48 54, 34 66 C 24 74, 20 62, 26 50 C 32 38, 46 34, 58 42" strokeWidth="3" />
          <path d="M 58 42 C 66 48, 64 60, 54 62" strokeWidth="2.2" />
          <path d="M 88 38 C 76 26, 62 24, 48 30 C 38 34, 30 46, 28 58" strokeWidth="2.6" />
          <path d="M 94 20 C 82 14, 70 16, 60 24" strokeWidth="2.2" />

          {/* Upper right branches */}
          <path d="M 115 62 C 132 52, 152 54, 166 66 C 176 74, 180 62, 174 50 C 168 38, 154 34, 142 42" strokeWidth="3" />
          <path d="M 142 42 C 134 48, 136 60, 146 62" strokeWidth="2.2" />
          <path d="M 112 38 C 124 26, 138 24, 152 30 C 162 34, 170 46, 172 58" strokeWidth="2.6" />
          <path d="M 106 20 C 118 14, 130 16, 140 24" strokeWidth="2.2" />

          {/* Inner heart/teardrop spirals */}
          <path d="M 92 68 C 96 62, 100 62, 100 66 C 100 62, 104 62, 108 68" strokeWidth="2.4" />
          <path d="M 94 48 C 97 42, 100 42, 100 46 C 100 42, 103 42, 106 48" strokeWidth="2.2" />
          <path d="M 96 30 C 98 25, 100 25, 100 28 C 100 25, 102 25, 104 30" strokeWidth="2.2" />
        </g>

        {/* ======================================================== */}
        {/* 6. AUTHENTIC DROOPING OAK LEAVES (Плавні дубові листки)  */}
        {/* ======================================================== */}
        <g fill="url(#silver-leaves-grad)" stroke="#475569" strokeWidth="0.6">
          {/* --- LEFT SIDE: 3 Drooping Oak Leaves --- */}
          {/* Inner Leaf */}
          <path
            d="M 80 132 
               C 84 138, 88 141, 85 146 
               C 83 150, 78 148, 80 154 
               C 81 158, 76 162, 73 165 
               C 70 161, 68 156, 70 152 
               C 66 148, 66 144, 71 141 
               C 69 137, 74 134, 78 133 Z"
          />
          {/* Middle Leaf */}
          <path
            d="M 64 132 
               C 68 138, 72 141, 69 146 
               C 67 150, 62 148, 64 154 
               C 65 158, 60 162, 57 165 
               C 54 161, 52 156, 54 152 
               C 50 148, 50 144, 55 141 
               C 53 137, 58 134, 62 133 Z"
          />
          {/* Outer Leaf */}
          <path
            d="M 48 138 
               C 51 144, 55 146, 52 151 
               C 50 155, 45 153, 47 158 
               C 47 162, 43 165, 40 168 
               C 38 164, 36 160, 38 156 
               C 35 153, 34 149, 39 146 
               C 38 142, 42 139, 46 138 Z"
          />

          {/* --- RIGHT SIDE: 3 Drooping Oak Leaves --- */}
          {/* Inner Leaf */}
          <path
            d="M 120 132 
               C 116 138, 112 141, 115 146 
               C 117 150, 122 148, 120 154 
               C 119 158, 124 162, 127 165 
               C 130 161, 132 156, 130 152 
               C 134 148, 134 144, 129 141 
               C 131 137, 126 134, 122 133 Z"
          />
          {/* Middle Leaf */}
          <path
            d="M 136 132 
               C 132 138, 128 141, 131 146 
               C 133 150, 138 148, 136 154 
               C 135 158, 140 162, 143 165 
               C 146 161, 148 156, 146 152 
               C 150 148, 150 144, 145 141 
               C 147 137, 142 134, 138 133 Z"
          />
          {/* Outer Leaf */}
          <path
            d="M 152 138 
               C 149 144, 145 146, 148 151 
               C 150 155, 155 153, 153 158 
               C 153 162, 157 165, 160 168 
               C 162 164, 164 160, 162 156 
               C 165 153, 166 149, 161 146 
               C 162 142, 158 139, 154 138 Z"
          />
        </g>
      </g>
    </svg>
  );
};
