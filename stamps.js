/**
 * stamps.js - ブログエディタ用スタンプ素材集
 * 全SVGは viewBox="0 0 100 100" 統一、自作（self-made）
 * Generated: 2026-04-20
 */

const STAMPS = [

  // ===== 感情系 =====

  {
    id: 'heart',
    label: 'ハート',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='hg' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#ff6b9d'/>
      <stop offset='100%' stop-color='#ff2d6b'/>
    </linearGradient>
  </defs>
  <path d='M50 82 C50 82 14 58 14 34 C14 22 23 14 34 14 C41 14 47 18 50 24 C53 18 59 14 66 14 C77 14 86 22 86 34 C86 58 50 82 50 82 Z'
        fill='url(#hg)' stroke='#c90050' stroke-width='3' stroke-linejoin='round'/>
  <ellipse cx='38' cy='30' rx='6' ry='4' fill='white' opacity='0.4' transform='rotate(-30 38 30)'/>
</svg>`
  },

  {
    id: 'sparkle',
    label: 'キラキラ',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <polygon points='50,8 55,42 88,50 55,58 50,92 45,58 12,50 45,42'
           fill='#FFD700' stroke='#FFA500' stroke-width='3' stroke-linejoin='round'/>
  <polygon points='20,15 22,24 31,26 22,28 20,37 18,28 9,26 18,24'
           fill='#FFE566' stroke='#FFA500' stroke-width='2'/>
  <polygon points='80,60 82,69 91,71 82,73 80,82 78,73 69,71 78,69'
           fill='#FFE566' stroke='#FFA500' stroke-width='2'/>
  <circle cx='50' cy='50' r='8' fill='white' opacity='0.5'/>
</svg>`
  },

  {
    id: 'thumbsup',
    label: 'OK',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <rect x='10' y='52' width='22' height='36' rx='6' fill='#FFD166' stroke='#E6A800' stroke-width='3'/>
  <path d='M32 60 L55 58 C62 57 65 52 68 44 L72 28 C73 24 70 20 66 20 C63 20 61 22 60 26 L56 44 L46 44 L46 60'
        fill='#FFD166' stroke='#E6A800' stroke-width='3' stroke-linejoin='round'/>
  <path d='M46 44 L32 44' stroke='#E6A800' stroke-width='3'/>
  <path d='M32 52 L55 50' stroke='#E6A800' stroke-width='2.5' stroke-linecap='round'/>
  <path d='M32 60 L54 58' stroke='#E6A800' stroke-width='2.5' stroke-linecap='round'/>
  <path d='M32 68 L52 67' stroke='#E6A800' stroke-width='2.5' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'nice',
    label: 'ナイス！',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <rect x='5' y='28' width='90' height='44' rx='22' fill='#7B2FFF' stroke='#5500CC' stroke-width='3'/>
  <text x='50' y='57' font-family='Arial,sans-serif' font-size='22' font-weight='bold'
        fill='white' text-anchor='middle'>NICE!</text>
  <circle cx='18' cy='18' r='7' fill='#FFD700' stroke='#FFA500' stroke-width='2'/>
  <circle cx='82' cy='18' r='5' fill='#FF6B9D' stroke='#CC0055' stroke-width='2'/>
  <circle cx='88' cy='82' r='6' fill='#00CFFF' stroke='#0090BB' stroke-width='2'/>
  <circle cx='12' cy='80' r='4' fill='#66FF99' stroke='#00BB44' stroke-width='2'/>
</svg>`
  },

  {
    id: 'yatta',
    label: 'やったー！',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='yg' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF9A3C'/>
      <stop offset='100%' stop-color='#FF4A7A'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='50' r='42' fill='url(#yg)' stroke='#CC2255' stroke-width='3'/>
  <path d='M28 60 Q50 80 72 60' stroke='white' stroke-width='4' fill='none' stroke-linecap='round'/>
  <circle cx='36' cy='40' r='6' fill='white'/>
  <circle cx='64' cy='40' r='6' fill='white'/>
  <circle cx='37' cy='39' r='3' fill='#333'/>
  <circle cx='65' cy='39' r='3' fill='#333'/>
  <path d='M20 20 L26 10' stroke='#FFE566' stroke-width='3' stroke-linecap='round'/>
  <path d='M80 20 L74 10' stroke='#FFE566' stroke-width='3' stroke-linecap='round'/>
  <path d='M15 40 L5 36' stroke='#FFE566' stroke-width='3' stroke-linecap='round'/>
  <path d='M85 40 L95 36' stroke='#FFE566' stroke-width='3' stroke-linecap='round'/>
</svg>`
  },

  // ===== 動物系 =====

  {
    id: 'cat',
    label: 'ネコ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <ellipse cx='50' cy='62' rx='30' ry='26' fill='#FFB347' stroke='#CC7700' stroke-width='3'/>
  <ellipse cx='50' cy='44' rx='22' ry='20' fill='#FFB347' stroke='#CC7700' stroke-width='3'/>
  <polygon points='28,32 22,10 38,26' fill='#FFB347' stroke='#CC7700' stroke-width='3' stroke-linejoin='round'/>
  <polygon points='72,32 78,10 62,26' fill='#FFB347' stroke='#CC7700' stroke-width='3' stroke-linejoin='round'/>
  <polygon points='28,32 22,10 38,26' fill='#FFCC80' stroke='none'/>
  <polygon points='72,32 78,10 62,26' fill='#FFCC80' stroke='none'/>
  <ellipse cx='42' cy='42' rx='5' ry='7' fill='#111'/>
  <ellipse cx='58' cy='42' rx='5' ry='7' fill='#111'/>
  <ellipse cx='42' cy='42' rx='2' ry='5' fill='#6633FF'/>
  <ellipse cx='58' cy='42' rx='2' ry='5' fill='#6633FF'/>
  <circle cx='43' cy='40' r='1.5' fill='white'/>
  <circle cx='59' cy='40' r='1.5' fill='white'/>
  <ellipse cx='50' cy='52' rx='4' ry='3' fill='#FF8888'/>
  <path d='M50 55 L42 58' stroke='#CC7700' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M50 55 L58 58' stroke='#CC7700' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M30 52 L18 50' stroke='#CC7700' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M30 55 L18 55' stroke='#CC7700' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M70 52 L82 50' stroke='#CC7700' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M70 55 L82 55' stroke='#CC7700' stroke-width='1.5' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'bear',
    label: 'クマ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <circle cx='28' cy='28' r='14' fill='#8B5E3C' stroke='#5C3D1E' stroke-width='3'/>
  <circle cx='72' cy='28' r='14' fill='#8B5E3C' stroke='#5C3D1E' stroke-width='3'/>
  <circle cx='50' cy='58' r='36' fill='#8B5E3C' stroke='#5C3D1E' stroke-width='3'/>
  <ellipse cx='50' cy='65' rx='16' ry='12' fill='#C49A6C'/>
  <circle cx='40' cy='48' r='7' fill='#3B2000'/>
  <circle cx='60' cy='48' r='7' fill='#3B2000'/>
  <circle cx='41' cy='46' r='2.5' fill='white'/>
  <circle cx='61' cy='46' r='2.5' fill='white'/>
  <ellipse cx='50' cy='62' rx='5' ry='3.5' fill='#5C3D1E'/>
  <path d='M44 68 Q50 74 56 68' stroke='#5C3D1E' stroke-width='2.5' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'rabbit',
    label: 'うさぎ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <ellipse cx='36' cy='30' rx='9' ry='22' fill='white' stroke='#CCAACC' stroke-width='3'/>
  <ellipse cx='64' cy='30' rx='9' ry='22' fill='white' stroke='#CCAACC' stroke-width='3'/>
  <ellipse cx='36' cy='30' rx='5' ry='16' fill='#FFAACC'/>
  <ellipse cx='64' cy='30' rx='5' ry='16' fill='#FFAACC'/>
  <ellipse cx='50' cy='62' rx='30' ry='28' fill='white' stroke='#CCAACC' stroke-width='3'/>
  <circle cx='41' cy='55' r='6' fill='#222'/>
  <circle cx='59' cy='55' r='6' fill='#222'/>
  <circle cx='42' cy='53' r='2' fill='white'/>
  <circle cx='60' cy='53' r='2' fill='white'/>
  <ellipse cx='50' cy='66' rx='5' ry='4' fill='#FF99CC'/>
  <path d='M50 70 L44 74' stroke='#CCAACC' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M50 70 L56 74' stroke='#CCAACC' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M32 70 L22 68' stroke='#CCAACC' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M32 73 L22 73' stroke='#CCAACC' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M68 70 L78 68' stroke='#CCAACC' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M68 73 L78 73' stroke='#CCAACC' stroke-width='1.5' stroke-linecap='round'/>
</svg>`
  },

  // ===== 食べ物系 =====

  {
    id: 'cake',
    label: 'ケーキ',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <rect x='14' y='58' width='72' height='30' rx='6' fill='#F4A261' stroke='#C96A1A' stroke-width='3'/>
  <rect x='20' y='42' width='60' height='20' rx='4' fill='#FFDDD2' stroke='#C96A1A' stroke-width='3'/>
  <path d='M20 42 Q50 36 80 42' stroke='#C96A1A' stroke-width='3' fill='none'/>
  <ellipse cx='30' cy='62' rx='8' ry='4' fill='#FF6B9D' opacity='0.7'/>
  <ellipse cx='50' cy='65' rx='8' ry='4' fill='#FFD700' opacity='0.7'/>
  <ellipse cx='70' cy='62' rx='8' ry='4' fill='#66CCFF' opacity='0.7'/>
  <rect x='47' y='28' width='6' height='16' rx='3' fill='#FFD166' stroke='#CC9900' stroke-width='2'/>
  <ellipse cx='50' cy='26' rx='4' ry='6' fill='#FF6B2B' stroke='#BB3300' stroke-width='2'/>
  <ellipse cx='50' cy='24' rx='2' ry='2' fill='#FFE566'/>
  <path d='M22 68 Q30 72 38 68' stroke='#C96A1A' stroke-width='2' fill='none'/>
  <path d='M62 68 Q70 72 78 68' stroke='#C96A1A' stroke-width='2' fill='none'/>
</svg>`
  },

  {
    id: 'coffee',
    label: 'コーヒー',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <path d='M20 40 L26 85 Q26 90 32 90 L62 90 Q68 90 68 85 L74 40 Z'
        fill='#D4A574' stroke='#8B5E3C' stroke-width='3' stroke-linejoin='round'/>
  <path d='M68 50 Q82 50 82 60 Q82 70 68 70' stroke='#8B5E3C' stroke-width='3' fill='none' stroke-linecap='round'/>
  <ellipse cx='47' cy='40' rx='27' ry='8' fill='#6B3A2A' stroke='#8B5E3C' stroke-width='3'/>
  <ellipse cx='47' cy='40' rx='22' ry='5' fill='#3D1F12'/>
  <path d='M36 26 Q38 18 36 12' stroke='#AAAAAA' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M47 22 Q50 12 47 6' stroke='#AAAAAA' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M58 26 Q60 18 58 12' stroke='#AAAAAA' stroke-width='2.5' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'pizza',
    label: 'ピザ',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <polygon points='50,8 92,88 8,88' fill='#F4A261' stroke='#C96A1A' stroke-width='3' stroke-linejoin='round'/>
  <polygon points='50,22 84,84 16,84' fill='#E63B2E'/>
  <polygon points='50,30 76,80 24,80' fill='#F4D03F'/>
  <circle cx='50' cy='55' r='6' fill='#C0392B'/>
  <circle cx='38' cy='68' r='5' fill='#C0392B'/>
  <circle cx='62' cy='68' r='5' fill='#C0392B'/>
  <circle cx='50' cy='70' r='4' fill='#2ECC71'/>
  <circle cx='42' cy='56' r='3' fill='#2ECC71'/>
  <circle cx='60' cy='58' r='3' fill='#2ECC71'/>
  <path d='M14,84 Q50,94 86,84' stroke='#C96A1A' stroke-width='3' fill='none' stroke-linecap='round'/>
</svg>`
  },

  // ===== 季節・自然系 =====

  {
    id: 'flower',
    label: '花',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <ellipse cx='50' cy='22' rx='12' ry='18' fill='#FF9EC4' stroke='#CC4488' stroke-width='3'/>
  <ellipse cx='50' cy='78' rx='12' ry='18' fill='#FF9EC4' stroke='#CC4488' stroke-width='3'/>
  <ellipse cx='22' cy='50' rx='18' ry='12' fill='#FF9EC4' stroke='#CC4488' stroke-width='3'/>
  <ellipse cx='78' cy='50' rx='18' ry='12' fill='#FF9EC4' stroke='#CC4488' stroke-width='3'/>
  <ellipse cx='28' cy='28' rx='12' ry='16' fill='#FFAACC' stroke='#CC4488' stroke-width='3' transform='rotate(-45 28 28)'/>
  <ellipse cx='72' cy='28' rx='12' ry='16' fill='#FFAACC' stroke='#CC4488' stroke-width='3' transform='rotate(45 72 28)'/>
  <ellipse cx='28' cy='72' rx='12' ry='16' fill='#FFAACC' stroke='#CC4488' stroke-width='3' transform='rotate(45 28 72)'/>
  <ellipse cx='72' cy='72' rx='12' ry='16' fill='#FFAACC' stroke='#CC4488' stroke-width='3' transform='rotate(-45 72 72)'/>
  <circle cx='50' cy='50' r='16' fill='#FFD700' stroke='#CC9900' stroke-width='3'/>
  <circle cx='50' cy='50' r='8' fill='#FFA500'/>
</svg>`
  },

  {
    id: 'sun',
    label: '太陽',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='sg' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FF9A00'/>
    </linearGradient>
  </defs>
  <line x1='50' y1='4' x2='50' y2='16' stroke='#FFAA00' stroke-width='4' stroke-linecap='round'/>
  <line x1='50' y1='84' x2='50' y2='96' stroke='#FFAA00' stroke-width='4' stroke-linecap='round'/>
  <line x1='4' y1='50' x2='16' y2='50' stroke='#FFAA00' stroke-width='4' stroke-linecap='round'/>
  <line x1='84' y1='50' x2='96' y2='50' stroke='#FFAA00' stroke-width='4' stroke-linecap='round'/>
  <line x1='17' y1='17' x2='25' y2='25' stroke='#FFAA00' stroke-width='4' stroke-linecap='round'/>
  <line x1='75' y1='75' x2='83' y2='83' stroke='#FFAA00' stroke-width='4' stroke-linecap='round'/>
  <line x1='83' y1='17' x2='75' y2='25' stroke='#FFAA00' stroke-width='4' stroke-linecap='round'/>
  <line x1='17' y1='83' x2='25' y2='75' stroke='#FFAA00' stroke-width='4' stroke-linecap='round'/>
  <circle cx='50' cy='50' r='26' fill='url(#sg)' stroke='#CC7700' stroke-width='3'/>
  <circle cx='42' cy='44' r='4' fill='#5C3300' opacity='0.6'/>
  <circle cx='58' cy='44' r='4' fill='#5C3300' opacity='0.6'/>
  <path d='M40 58 Q50 66 60 58' stroke='#5C3300' stroke-width='3' fill='none' stroke-linecap='round' opacity='0.6'/>
</svg>`
  },

  {
    id: 'star',
    label: '星',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='stg' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <polygon points='50,6 61,38 95,38 68,58 79,90 50,70 21,90 32,58 5,38 39,38'
           fill='url(#stg)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
  <ellipse cx='40' cy='36' rx='8' ry='5' fill='white' opacity='0.35' transform='rotate(-25 40 36)'/>
</svg>`
  },

  // ===== メッセージ系 =====

  {
    id: 'iine',
    label: 'いいね',
    category: 'message',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='ig' x1='0%' y1='0%' x2='100%' y2='0%'>
      <stop offset='0%' stop-color='#4FC3F7'/>
      <stop offset='100%' stop-color='#0288D1'/>
    </linearGradient>
  </defs>
  <rect x='5' y='25' width='90' height='50' rx='25' fill='url(#ig)' stroke='#01579B' stroke-width='3'/>
  <text x='50' y='58' font-family='Noto Sans JP,Yu Gothic,sans-serif' font-size='20' font-weight='bold'
        fill='white' text-anchor='middle'>いいね</text>
  <path d='M12 20 L18 8 M20 18 L20 6 M28 20 L22 8'
        stroke='#FFD700' stroke-width='2.5' stroke-linecap='round'/>
  <path d='M80 20 L86 8 M88 18 L88 6 M96 20 L90 8'
        stroke='#FFD700' stroke-width='2.5' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'congrats',
    label: 'おめでとう',
    category: 'message',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='cg' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFD700'/>
      <stop offset='100%' stop-color='#FF8C00'/>
    </linearGradient>
  </defs>
  <path d='M50 8 L56 30 L80 22 L68 42 L92 48 L70 58 L80 80 L58 70 L50 92 L42 70 L20 80 L30 58 L8 48 L32 42 L20 22 L44 30 Z'
        fill='url(#cg)' stroke='#CC6600' stroke-width='2.5' stroke-linejoin='round'/>
  <text x='50' y='56' font-family='Noto Sans JP,Yu Gothic,sans-serif' font-size='10' font-weight='bold'
        fill='white' text-anchor='middle'>おめ</text>
  <text x='50' y='68' font-family='Noto Sans JP,Yu Gothic,sans-serif' font-size='10' font-weight='bold'
        fill='white' text-anchor='middle'>でとう</text>
</svg>`
  },

  {
    id: 'thanks',
    label: 'ありがとう',
    category: 'message',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='tg' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#A855F7'/>
      <stop offset='100%' stop-color='#7C3AED'/>
    </linearGradient>
  </defs>
  <rect x='5' y='28' width='90' height='44' rx='10' fill='url(#tg)' stroke='#5B21B6' stroke-width='3'/>
  <text x='50' y='52' font-family='Noto Sans JP,Yu Gothic,sans-serif' font-size='13' font-weight='bold'
        fill='white' text-anchor='middle'>ありがとう</text>
  <text x='50' y='66' font-family='Noto Sans JP,Yu Gothic,sans-serif' font-size='10'
        fill='#E9D5FF' text-anchor='middle'>Thank you!</text>
  <circle cx='16' cy='16' r='5' fill='#FF9EC4' stroke='#CC4488' stroke-width='2'/>
  <circle cx='84' cy='16' r='4' fill='#FFD700' stroke='#CC9900' stroke-width='2'/>
  <circle cx='84' cy='84' r='5' fill='#66CCFF' stroke='#0099CC' stroke-width='2'/>
  <circle cx='16' cy='84' r='4' fill='#66FF99' stroke='#00AA44' stroke-width='2'/>
</svg>`
  },

  // ===== ボーナス追加スタンプ =====

  {
    id: 'rainbow',
    label: 'にじ',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <path d='M10 80 Q50 10 90 80' stroke='#FF0000' stroke-width='5' fill='none' stroke-linecap='round'/>
  <path d='M15 82 Q50 18 85 82' stroke='#FF8C00' stroke-width='5' fill='none' stroke-linecap='round'/>
  <path d='M20 84 Q50 26 80 84' stroke='#FFD700' stroke-width='5' fill='none' stroke-linecap='round'/>
  <path d='M25 86 Q50 34 75 86' stroke='#32CD32' stroke-width='5' fill='none' stroke-linecap='round'/>
  <path d='M30 88 Q50 42 70 88' stroke='#00BFFF' stroke-width='5' fill='none' stroke-linecap='round'/>
  <path d='M35 90 Q50 50 65 90' stroke='#8A2BE2' stroke-width='5' fill='none' stroke-linecap='round'/>
  <ellipse cx='20' cy='76' rx='12' ry='8' fill='white' opacity='0.8'/>
  <ellipse cx='80' cy='76' rx='12' ry='8' fill='white' opacity='0.8'/>
</svg>`
  },

  {
    id: 'music',
    label: 'おんがく',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <rect x='40' y='14' width='40' height='6' rx='3' fill='#FF6B9D' stroke='#CC2266' stroke-width='2'/>
  <rect x='55' y='14' width='4' height='36' rx='2' fill='#FF6B9D' stroke='#CC2266' stroke-width='2'/>
  <rect x='75' y='14' width='4' height='30' rx='2' fill='#FF6B9D' stroke='#CC2266' stroke-width='2'/>
  <ellipse cx='48' cy='56' rx='13' ry='9' fill='#FF6B9D' stroke='#CC2266' stroke-width='2.5' transform='rotate(-20 48 56)'/>
  <ellipse cx='68' cy='50' rx='12' ry='8' fill='#FF6B9D' stroke='#CC2266' stroke-width='2.5' transform='rotate(-20 68 50)'/>
  <text x='18' y='42' font-family='Arial,sans-serif' font-size='18' fill='#FFD700'>♪</text>
  <text x='8' y='72' font-family='Arial,sans-serif' font-size='14' fill='#A855F7'>♩</text>
  <text x='24' y='82' font-family='Arial,sans-serif' font-size='16' fill='#66CCFF'>♫</text>
</svg>`
  },

  {
    id: 'gift',
    label: 'プレゼント',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <rect x='12' y='46' width='76' height='46' rx='6' fill='#FF6B9D' stroke='#CC2266' stroke-width='3'/>
  <rect x='8' y='34' width='84' height='16' rx='6' fill='#FF9EC4' stroke='#CC2266' stroke-width='3'/>
  <rect x='44' y='34' width='12' height='58' fill='#FFD700' stroke='#CC9900' stroke-width='2'/>
  <rect x='8' y='42' width='84' height='8' fill='#FFD700' stroke='none'/>
  <path d='M50 34 C50 34 34 28 30 20 C26 12 32 8 38 12 C44 16 50 34 50 34 Z'
        fill='#FFD700' stroke='#CC9900' stroke-width='2'/>
  <path d='M50 34 C50 34 66 28 70 20 C74 12 68 8 62 12 C56 16 50 34 50 34 Z'
        fill='#FFD700' stroke='#CC9900' stroke-width='2'/>
  <circle cx='30' cy='65' r='8' fill='white' opacity='0.2'/>
  <circle cx='72' cy='70' r='5' fill='white' opacity='0.2'/>
</svg>`
  },


  // ===== 感情カテゴリ 追加43種 =====

  {
    id: 'cry',
    label: 'なみだ',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='cry_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#7EC8E3'/>
      <stop offset='100%' stop-color='#4A9FBF'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='48' r='36' fill='url(#cry_g1)' stroke='#2277AA' stroke-width='3'/>
  <circle cx='36' cy='40' r='7' fill='white'/>
  <circle cx='64' cy='40' r='7' fill='white'/>
  <circle cx='37' cy='41' r='4' fill='#222'/>
  <circle cx='65' cy='41' r='4' fill='#222'/>
  <circle cx='38' cy='39' r='1.5' fill='white'/>
  <circle cx='66' cy='39' r='1.5' fill='white'/>
  <path d='M36 56 Q50 62 64 56' stroke='#2277AA' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M37 47 Q34 58 32 68 Q31 72 34 73 Q37 74 38 70 Q40 60 37 47' fill='#A8E4FF' stroke='#4499CC' stroke-width='2'/>
  <path d='M63 47 Q66 58 68 68 Q69 72 66 73 Q63 74 62 70 Q60 60 63 47' fill='#A8E4FF' stroke='#4499CC' stroke-width='2'/>
</svg>`
  },

  {
    id: 'angry',
    label: 'おこ',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='angry_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF6B35'/>
      <stop offset='100%' stop-color='#E63B2E'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='50' r='38' fill='url(#angry_g1)' stroke='#AA1100' stroke-width='3'/>
  <circle cx='36' cy='44' r='7' fill='white'/>
  <circle cx='64' cy='44' r='7' fill='white'/>
  <circle cx='37' cy='45' r='4' fill='#111'/>
  <circle cx='65' cy='45' r='4' fill='#111'/>
  <circle cx='38' cy='43' r='1.5' fill='white'/>
  <circle cx='66' cy='43' r='1.5' fill='white'/>
  <path d='M29 34 L43 40' stroke='#660000' stroke-width='4' stroke-linecap='round'/>
  <path d='M71 34 L57 40' stroke='#660000' stroke-width='4' stroke-linecap='round'/>
  <path d='M34 64 Q50 58 66 64' stroke='#660000' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <path d='M44 68 L44 76 M50 70 L50 78 M56 68 L56 76' stroke='#660000' stroke-width='2.5' stroke-linecap='round'/>
  <path d='M70 18 L80 10 M76 22 L88 16' stroke='#FFD700' stroke-width='3' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'surprised',
    label: 'びっくり',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='surprised_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFB300'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='50' r='38' fill='url(#surprised_g1)' stroke='#CC8800' stroke-width='3'/>
  <circle cx='36' cy='42' r='9' fill='white'/>
  <circle cx='64' cy='42' r='9' fill='white'/>
  <circle cx='37' cy='43' r='5' fill='#111'/>
  <circle cx='65' cy='43' r='5' fill='#111'/>
  <circle cx='38' cy='41' r='2' fill='white'/>
  <circle cx='66' cy='41' r='2' fill='white'/>
  <path d='M30 30 L34 22' stroke='#CC8800' stroke-width='3' stroke-linecap='round'/>
  <path d='M70 30 L66 22' stroke='#CC8800' stroke-width='3' stroke-linecap='round'/>
  <ellipse cx='50' cy='68' rx='10' ry='12' fill='#CC6600' stroke='#884400' stroke-width='2'/>
  <ellipse cx='50' cy='68' rx='6' ry='8' fill='#440000'/>
  <text x='82' y='22' font-family='Arial,sans-serif' font-size='22' font-weight='bold' fill='#E63B2E'>!</text>
</svg>`
  },

  {
    id: 'laugh',
    label: 'わらい',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='laugh_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFD166'/>
      <stop offset='100%' stop-color='#FF9A3C'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='50' r='38' fill='url(#laugh_g1)' stroke='#CC6600' stroke-width='3'/>
  <path d='M30 38 Q36 32 42 38' stroke='#CC6600' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M58 38 Q64 32 70 38' stroke='#CC6600' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M24 56 Q50 82 76 56' stroke='#CC6600' stroke-width='3.5' fill='#FF7700' stroke-linecap='round'/>
  <path d='M24 56 Q50 82 76 56 Q76 56 76 60 Q50 88 24 60 Z' fill='#FF4400'/>
  <path d='M32 64 Q50 72 68 64' stroke='white' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M10 30 L18 22 M90 30 L82 22' stroke='#FFE566' stroke-width='3' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'wink',
    label: 'ウィンク',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='wink_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF9EC4'/>
      <stop offset='100%' stop-color='#FF6B9D'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='50' r='38' fill='url(#wink_g1)' stroke='#CC2266' stroke-width='3'/>
  <circle cx='36' cy='42' r='8' fill='white'/>
  <circle cx='37' cy='43' r='4.5' fill='#222'/>
  <circle cx='38' cy='41' r='1.8' fill='white'/>
  <path d='M56 38 Q64 34 72 38' stroke='#CC2266' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <path d='M30 60 Q50 76 70 60' stroke='#CC2266' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <ellipse cx='30' cy='48' rx='5' ry='3' fill='#FF99BB' opacity='0.6'/>
  <ellipse cx='70' cy='48' rx='5' ry='3' fill='#FF99BB' opacity='0.6'/>
  <circle cx='74' cy='20' r='5' fill='#FFD700' stroke='#CC9900' stroke-width='2'/>
</svg>`
  },

  {
    id: 'sweat',
    label: 'あせ',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='sweat_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFB300'/>
    </linearGradient>
  </defs>
  <circle cx='48' cy='52' r='36' fill='url(#sweat_g1)' stroke='#CC8800' stroke-width='3'/>
  <circle cx='36' cy='44' r='7' fill='white'/>
  <circle cx='60' cy='44' r='7' fill='white'/>
  <circle cx='37' cy='45' r='4' fill='#222'/>
  <circle cx='61' cy='45' r='4' fill='#222'/>
  <circle cx='38' cy='43' r='1.5' fill='white'/>
  <circle cx='62' cy='43' r='1.5' fill='white'/>
  <path d='M30 58 Q44 54 58 58' stroke='#CC8800' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M76 20 Q78 10 80 20 Q82 30 76 20' fill='#7EC8E3' stroke='#4499CC' stroke-width='2'/>
  <path d='M86 30 Q88 20 90 30 Q92 40 86 30' fill='#7EC8E3' stroke='#4499CC' stroke-width='2'/>
  <path d='M32 34 L28 24 M42 30 L40 20' stroke='#CC8800' stroke-width='2' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'sleep',
    label: 'ねむい',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='sleep_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#B8A9F0'/>
      <stop offset='100%' stop-color='#7B68CC'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='55' r='36' fill='url(#sleep_g1)' stroke='#5544AA' stroke-width='3'/>
  <path d='M28 44 Q36 40 44 44' stroke='#5544AA' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <path d='M56 44 Q64 40 72 44' stroke='#5544AA' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <path d='M32 62 Q50 70 68 62' stroke='#5544AA' stroke-width='3' fill='none' stroke-linecap='round'/>
  <text x='72' y='30' font-family='Arial,sans-serif' font-size='16' font-weight='bold' fill='#DDCCFF'>Z</text>
  <text x='80' y='18' font-family='Arial,sans-serif' font-size='12' font-weight='bold' fill='#DDCCFF'>z</text>
  <text x='87' y='10' font-family='Arial,sans-serif' font-size='9' font-weight='bold' fill='#DDCCFF'>z</text>
  <circle cx='20' cy='28' r='8' fill='#FFE566' stroke='#BBAA00' stroke-width='2' opacity='0.7'/>
</svg>`
  },

  {
    id: 'love',
    label: 'ラブ',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='love_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF9EC4'/>
      <stop offset='100%' stop-color='#FF2D6B'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='50' r='38' fill='url(#love_g1)' stroke='#CC0055' stroke-width='3'/>
  <circle cx='36' cy='40' r='8' fill='white'/>
  <circle cx='64' cy='40' r='8' fill='white'/>
  <circle cx='37' cy='41' r='4.5' fill='#FF2D6B'/>
  <circle cx='65' cy='41' r='4.5' fill='#FF2D6B'/>
  <circle cx='38' cy='39' r='1.8' fill='white'/>
  <circle cx='66' cy='39' r='1.8' fill='white'/>
  <path d='M26 62 Q50 80 74 62' stroke='#CC0055' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <path d='M18 20 C18 20 14 14 20 12 C24 10 26 16 22 20 Z' fill='#FF6B9D' stroke='#CC2266' stroke-width='1.5'/>
  <path d='M82 20 C82 20 86 14 80 12 C76 10 74 16 78 20 Z' fill='#FF6B9D' stroke='#CC2266' stroke-width='1.5'/>
</svg>`
  },

  {
    id: 'cool',
    label: 'クール',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='cool_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#00CFFF'/>
      <stop offset='100%' stop-color='#0066CC'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='50' r='38' fill='url(#cool_g1)' stroke='#003399' stroke-width='3'/>
  <rect x='22' y='36' width='56' height='16' rx='8' fill='#111' stroke='#333' stroke-width='2'/>
  <ellipse cx='36' cy='44' rx='8' ry='6' fill='#222'/>
  <ellipse cx='64' cy='44' rx='8' ry='6' fill='#222'/>
  <circle cx='38' cy='43' r='2' fill='#00CFFF' opacity='0.8'/>
  <circle cx='66' cy='43' r='2' fill='#00CFFF' opacity='0.8'/>
  <path d='M30 64 Q50 72 70 64' stroke='white' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M6 44 L22 44' stroke='#111' stroke-width='3' stroke-linecap='round'/>
  <path d='M78 44 L94 44' stroke='#111' stroke-width='3' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'sad',
    label: 'かなしい',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='sad_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#9BB8D4'/>
      <stop offset='100%' stop-color='#5577AA'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='50' r='38' fill='url(#sad_g1)' stroke='#334488' stroke-width='3'/>
  <circle cx='36' cy='42' r='7' fill='white'/>
  <circle cx='64' cy='42' r='7' fill='white'/>
  <circle cx='37' cy='43' r='4' fill='#334488'/>
  <circle cx='65' cy='43' r='4' fill='#334488'/>
  <circle cx='38' cy='41' r='1.5' fill='white'/>
  <circle cx='66' cy='41' r='1.5' fill='white'/>
  <path d='M30 32 L38 38' stroke='#334488' stroke-width='3' stroke-linecap='round'/>
  <path d='M70 32 L62 38' stroke='#334488' stroke-width='3' stroke-linecap='round'/>
  <path d='M32 66 Q50 58 68 66' stroke='#334488' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <path d='M36 50 Q34 60 32 68' stroke='#7EC8E3' stroke-width='2' stroke-linecap='round' fill='none'/>
</svg>`
  },

  {
    id: 'shock',
    label: 'しょっく',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='shock_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FF9A3C'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='52' r='36' fill='url(#shock_g1)' stroke='#CC6600' stroke-width='3'/>
  <circle cx='36' cy='44' r='10' fill='white'/>
  <circle cx='64' cy='44' r='10' fill='white'/>
  <circle cx='37' cy='45' r='6' fill='#111'/>
  <circle cx='65' cy='45' r='6' fill='#111'/>
  <circle cx='38' cy='43' r='2.5' fill='white'/>
  <circle cx='66' cy='43' r='2.5' fill='white'/>
  <ellipse cx='50' cy='68' rx='8' ry='6' fill='#884400'/>
  <ellipse cx='50' cy='68' rx='5' ry='4' fill='#220000'/>
  <path d='M28 28 L22 16 M34 24 L30 12' stroke='#FF4400' stroke-width='3' stroke-linecap='round'/>
  <path d='M72 28 L78 16 M66 24 L70 12' stroke='#FF4400' stroke-width='3' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'nervous',
    label: 'どきどき',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='nervous_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFB8CC'/>
      <stop offset='100%' stop-color='#FF6699'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='50' r='38' fill='url(#nervous_g1)' stroke='#CC2255' stroke-width='3'/>
  <circle cx='36' cy='42' r='7' fill='white'/>
  <circle cx='64' cy='42' r='7' fill='white'/>
  <circle cx='37' cy='43' r='4' fill='#333'/>
  <circle cx='65' cy='43' r='4' fill='#333'/>
  <circle cx='38' cy='41' r='1.5' fill='white'/>
  <circle cx='66' cy='41' r='1.5' fill='white'/>
  <path d='M34 60 Q42 56 50 60 Q58 64 66 60' stroke='#CC2255' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M14 30 C14 30 10 24 16 22 C20 20 22 26 18 30 Z' fill='#FF6B9D' stroke='#CC2266' stroke-width='1.5'/>
  <path d='M86 30 C86 30 90 24 84 22 C80 20 78 26 82 30 Z' fill='#FF6B9D' stroke='#CC2266' stroke-width='1.5'/>
  <path d='M42 24 L36 16 M50 20 L50 10 M58 24 L64 16' stroke='#FFE566' stroke-width='2.5' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'proud',
    label: 'どや',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='proud_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFD700'/>
      <stop offset='100%' stop-color='#FF8C00'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='50' r='38' fill='url(#proud_g1)' stroke='#CC6600' stroke-width='3'/>
  <path d='M28 38 Q36 32 44 36' stroke='#664400' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <path d='M56 36 Q64 32 72 38' stroke='#664400' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <circle cx='36' cy='44' r='5' fill='#664400'/>
  <circle cx='64' cy='44' r='5' fill='#664400'/>
  <circle cx='37' cy='42' r='1.8' fill='white'/>
  <circle cx='65' cy='42' r='1.8' fill='white'/>
  <path d='M28 62 Q50 72 72 62' stroke='#664400' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <ellipse cx='30' cy='52' rx='6' ry='4' fill='#FFB300' opacity='0.5'/>
  <ellipse cx='70' cy='52' rx='6' ry='4' fill='#FFB300' opacity='0.5'/>
</svg>`
  },

  {
    id: 'thinking',
    label: 'かんがえ中',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='thinking_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#C8E6FF'/>
      <stop offset='100%' stop-color='#7BB8E8'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='54' r='36' fill='url(#thinking_g1)' stroke='#3377BB' stroke-width='3'/>
  <circle cx='36' cy='46' r='7' fill='white'/>
  <circle cx='60' cy='46' r='7' fill='white'/>
  <circle cx='37' cy='47' r='4' fill='#3377BB'/>
  <circle cx='61' cy='47' r='4' fill='#3377BB'/>
  <circle cx='38' cy='45' r='1.5' fill='white'/>
  <circle cx='62' cy='45' r='1.5' fill='white'/>
  <path d='M32 62 Q46 58 60 62' stroke='#3377BB' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M66 56 Q72 48 70 40' stroke='#3377BB' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <circle cx='68' cy='36' r='4' fill='#3377BB'/>
  <circle cx='75' cy='16' r='8' fill='#FFE566' stroke='#BBAA00' stroke-width='2'/>
  <circle cx='82' cy='26' r='5' fill='#FFE566' stroke='#BBAA00' stroke-width='2'/>
</svg>`
  },

  {
    id: 'hungry',
    label: 'おなかへった',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='hungry_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFD166'/>
      <stop offset='100%' stop-color='#FF9A3C'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='50' r='38' fill='url(#hungry_g1)' stroke='#CC6600' stroke-width='3'/>
  <circle cx='36' cy='42' r='7' fill='white'/>
  <circle cx='64' cy='42' r='7' fill='white'/>
  <circle cx='37' cy='43' r='4' fill='#884400'/>
  <circle cx='65' cy='43' r='4' fill='#884400'/>
  <circle cx='38' cy='41' r='1.5' fill='white'/>
  <circle cx='66' cy='41' r='1.5' fill='white'/>
  <path d='M32 58 Q50 52 68 58' stroke='#884400' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M38 68 L40 74 M50 66 L50 72 M62 68 L60 74' stroke='#884400' stroke-width='2.5' stroke-linecap='round'/>
  <ellipse cx='50' cy='78' rx='14' ry='4' fill='#CC6600' opacity='0.3'/>
  <text x='78' y='22' font-family='Arial,sans-serif' font-size='18' fill='#E63B2E'>~</text>
</svg>`
  },

  {
    id: 'fire',
    label: 'ファイヤー',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='fire_g1' x1='0%' y1='0%' x2='0%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='50%' stop-color='#FF6B35'/>
      <stop offset='100%' stop-color='#CC2200'/>
    </linearGradient>
  </defs>
  <path d='M50 8 C50 8 62 24 58 36 C66 28 68 16 68 16 C80 32 82 50 72 64 C78 58 80 48 76 42 C84 56 82 72 68 82 C72 76 72 68 68 64 C64 78 54 86 50 92 C46 86 36 78 32 64 C28 68 28 76 32 82 C18 72 16 56 24 42 C20 48 22 58 28 64 C18 50 20 32 32 16 C32 16 34 28 42 36 C38 24 50 8 50 8 Z'
        fill='url(#fire_g1)' stroke='#CC2200' stroke-width='2' stroke-linejoin='round'/>
  <ellipse cx='50' cy='72' rx='12' ry='8' fill='#FFE566' opacity='0.6'/>
</svg>`
  },

  {
    id: 'broken_heart',
    label: 'しつれん',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='broken_heart_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#AA4466'/>
      <stop offset='100%' stop-color='#770033'/>
    </linearGradient>
  </defs>
  <path d='M50 80 C50 80 14 56 14 32 C14 20 23 12 34 12 C41 12 47 16 50 22 C53 16 59 12 66 12 C77 12 86 20 86 32 C86 56 50 80 50 80 Z'
        fill='url(#broken_heart_g1)' stroke='#440022' stroke-width='3' stroke-linejoin='round'/>
  <path d='M50 22 L44 42 L54 42 L46 64' stroke='white' stroke-width='4' fill='none' stroke-linecap='round' stroke-linejoin='round'/>
  <line x1='50' y1='22' x2='50' y2='80' stroke='#440022' stroke-width='2.5' stroke-dasharray='4,3'/>
</svg>`
  },

  {
    id: 'clap',
    label: 'はくしゅ',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='clap_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFD166'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <path d='M32 40 L26 26 C24 22 28 18 32 20 L44 40' fill='url(#clap_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M40 36 L30 18 C28 14 32 10 36 13 L48 36' fill='url(#clap_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M48 36 L42 18 C40 14 45 10 48 14 L56 36' fill='url(#clap_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M56 38 L54 20 C53 16 58 14 60 18 L62 38' fill='url(#clap_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M32 40 Q28 56 36 68 Q44 80 56 82 Q70 82 76 70 Q82 58 76 44 L62 38 L56 38 L48 36 L40 36 L32 40 Z'
        fill='url(#clap_g1)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
  <path d='M18 28 L10 22 M14 38 L6 36 M22 18 L18 10' stroke='#FFE566' stroke-width='2.5' stroke-linecap='round'/>
  <path d='M82 28 L90 22 M86 38 L94 36 M78 18 L82 10' stroke='#FFE566' stroke-width='2.5' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'peace',
    label: 'ピース',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='peace_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFD166'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <path d='M28 56 L22 30 C21 26 25 22 29 25 L36 44' fill='url(#peace_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M36 52 L28 24 C27 20 31 16 35 20 L44 48' fill='url(#peace_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M44 50 L40 26 C39 22 44 18 47 22 L50 48' fill='url(#peace_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M50 48 L50 28 C50 24 55 22 57 26 L58 48' fill='url(#peace_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M28 56 Q26 68 34 76 Q44 84 56 82 Q68 80 70 68 L58 48 L50 48 L44 50 L36 52 L28 56 Z'
        fill='url(#peace_g1)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
</svg>`
  },

  {
    id: 'ok_hand',
    label: 'OKサイン',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='ok_hand_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFD166'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <circle cx='38' cy='32' r='14' fill='url(#ok_hand_g1)' stroke='#CC8800' stroke-width='3'/>
  <path d='M28 42 Q24 52 28 62' stroke='#CC8800' stroke-width='8' fill='none' stroke-linecap='round'/>
  <path d='M48 42 Q52 52 48 62' stroke='#CC8800' stroke-width='8' fill='url(#ok_hand_g1)'/>
  <path d='M44 58 L56 48 C60 44 65 46 64 52 L58 72' fill='url(#ok_hand_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M52 62 L62 52 C66 48 71 50 70 56 L66 74' fill='url(#ok_hand_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M60 66 L68 58 C72 54 77 56 75 62 L72 78' fill='url(#ok_hand_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M28 62 Q30 80 44 84 Q58 88 68 78 L72 78 L75 62 L70 56 L64 52 L58 72 L52 72 L48 62 L28 62 Z'
        fill='url(#ok_hand_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
</svg>`
  },

  {
    id: 'pray',
    label: 'おねがい',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='pray_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFD166'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <path d='M50 14 L28 40 L22 70 Q22 78 30 80 L50 86 L70 80 Q78 78 78 70 L72 40 Z'
        fill='url(#pray_g1)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
  <line x1='50' y1='40' x2='50' y2='86' stroke='#CC8800' stroke-width='2.5'/>
  <path d='M28 40 L50 14 L72 40' stroke='#CC8800' stroke-width='3' fill='none' stroke-linejoin='round'/>
  <path d='M32 50 L50 28 L68 50' stroke='#FFEE99' stroke-width='2' fill='none' stroke-linejoin='round' opacity='0.6'/>
  <path d='M18 22 L12 14 M14 32 L6 28' stroke='#FFE566' stroke-width='2.5' stroke-linecap='round'/>
  <path d='M82 22 L88 14 M86 32 L94 28' stroke='#FFE566' stroke-width='2.5' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'wave',
    label: 'バイバイ',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='wave_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFD166'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <path d='M36 52 L22 32 C20 28 24 22 28 26 L44 48' fill='url(#wave_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M44 48 L32 24 C30 20 35 16 38 20 L52 46' fill='url(#wave_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M52 46 L44 22 C43 18 48 14 51 18 L60 44' fill='url(#wave_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M60 44 L56 22 C55 18 60 16 62 20 L68 44' fill='url(#wave_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M68 44 L68 26 C68 22 73 20 74 24 L76 46' fill='url(#wave_g1)' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M36 52 Q34 68 44 76 Q56 84 68 78 L76 46 L68 44 L60 44 L52 46 L44 48 L36 52 Z'
        fill='url(#wave_g1)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
  <path d='M14 62 L8 54 M10 72 L4 68' stroke='#FFE566' stroke-width='2.5' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'point_up',
    label: 'ポイント',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='point_up_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFD166'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <path d='M46 14 C46 14 42 10 46 7 C50 4 54 8 54 14 L54 50 L64 50 C68 50 70 55 68 58 L58 80 Q54 88 46 88 L34 88 Q24 88 22 78 L18 60 C17 56 20 52 24 52 L30 52 C28 48 28 40 30 34 L30 20 C30 16 34 12 38 14 L44 28' fill='url(#point_up_g1)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
  <path d='M44 28 L44 14' fill='url(#point_up_g1)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
  <path d='M80 22 L72 14 M86 32 L78 24 M78 14 L82 6' stroke='#FFE566' stroke-width='2.5' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'muscle',
    label: 'マッスル',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='muscle_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF9A3C'/>
      <stop offset='100%' stop-color='#E63B2E'/>
    </linearGradient>
  </defs>
  <path d='M26 60 C18 60 14 52 18 46 C12 46 10 38 16 34 C14 28 18 24 24 26 L30 28 C32 22 40 18 46 22 L52 26 C56 22 64 22 68 28 C74 26 80 30 78 36 C84 34 88 42 82 48 C86 52 84 60 76 60 L70 60 C68 66 64 72 58 74 L58 82 L42 82 L42 74 C36 72 32 66 30 60 Z'
        fill='url(#muscle_g1)' stroke='#AA2200' stroke-width='3' stroke-linejoin='round'/>
  <path d='M36 46 Q50 54 64 46' stroke='#AA2200' stroke-width='2' fill='none' stroke-linecap='round'/>
  <ellipse cx='36' cy='44' rx='6' ry='4' fill='#FF6633' opacity='0.5'/>
  <ellipse cx='64' cy='44' rx='6' ry='4' fill='#FF6633' opacity='0.5'/>
</svg>`
  },

  {
    id: 'dizzy',
    label: 'くらくら',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='dizzy_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFD166'/>
      <stop offset='100%' stop-color='#FFB300'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='56' r='34' fill='url(#dizzy_g1)' stroke='#CC8800' stroke-width='3'/>
  <path d='M30 40 L38 48 M38 40 L30 48' stroke='#CC4400' stroke-width='3.5' stroke-linecap='round'/>
  <path d='M62 40 L70 48 M70 40 L62 48' stroke='#CC4400' stroke-width='3.5' stroke-linecap='round'/>
  <path d='M34 66 Q50 62 66 66' stroke='#CC8800' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M28 28 Q50 16 72 28' stroke='#FFD700' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M20 20 Q50 4 80 20' stroke='#FFD700' stroke-width='2.5' fill='none' stroke-linecap='round' opacity='0.6'/>
</svg>`
  },

  {
    id: 'dead',
    label: 'ふらふら',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='dead_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#C8D8D8'/>
      <stop offset='100%' stop-color='#8899AA'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='52' r='36' fill='url(#dead_g1)' stroke='#556677' stroke-width='3'/>
  <path d='M28 38 L38 48 M38 38 L28 48' stroke='#334455' stroke-width='3.5' stroke-linecap='round'/>
  <path d='M62 38 L72 48 M72 38 L62 48' stroke='#334455' stroke-width='3.5' stroke-linecap='round'/>
  <path d='M34 64 Q50 60 66 64' stroke='#334455' stroke-width='3' fill='none' stroke-linecap='round'/>
  <text x='72' y='28' font-family='Arial,sans-serif' font-size='14' font-weight='bold' fill='#7799BB'>Z</text>
  <text x='80' y='18' font-family='Arial,sans-serif' font-size='10' font-weight='bold' fill='#7799BB'>z</text>
  <ellipse cx='30' cy='54' rx='5' ry='3' fill='#AABBCC' opacity='0.5'/>
  <ellipse cx='70' cy='54' rx='5' ry='3' fill='#AABBCC' opacity='0.5'/>
</svg>`
  },

  {
    id: 'money',
    label: 'おかね',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='money_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#85DD6A'/>
      <stop offset='100%' stop-color='#3DAA2E'/>
    </linearGradient>
  </defs>
  <rect x='8' y='28' width='84' height='54' rx='8' fill='url(#money_g1)' stroke='#227700' stroke-width='3'/>
  <circle cx='50' cy='55' r='18' fill='#EEFFCC' stroke='#227700' stroke-width='2'/>
  <text x='50' y='61' font-family='Arial,sans-serif' font-size='22' font-weight='bold' fill='#227700' text-anchor='middle'>$</text>
  <circle cx='20' cy='55' r='8' fill='#CCFFAA' stroke='#227700' stroke-width='2'/>
  <circle cx='80' cy='55' r='8' fill='#CCFFAA' stroke='#227700' stroke-width='2'/>
  <text x='50' y='22' font-family='Arial,sans-serif' font-size='14' font-weight='bold' fill='#227700' text-anchor='middle'>¥ $ €</text>
</svg>`
  },

  {
    id: 'crown',
    label: 'おうかん',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='crown_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <path d='M10 75 L10 40 L30 62 L50 20 L70 62 L90 40 L90 75 Z'
        fill='url(#crown_g1)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
  <rect x='8' y='74' width='84' height='14' rx='4' fill='url(#crown_g1)' stroke='#CC8800' stroke-width='3'/>
  <circle cx='50' cy='22' r='6' fill='#FF6B9D' stroke='#CC2266' stroke-width='2'/>
  <circle cx='10' cy='42' r='5' fill='#00CFFF' stroke='#0077AA' stroke-width='2'/>
  <circle cx='90' cy='42' r='5' fill='#00CFFF' stroke='#0077AA' stroke-width='2'/>
  <circle cx='30' cy='64' r='4' fill='#E63B2E' stroke='#AA1100' stroke-width='2'/>
  <circle cx='70' cy='64' r='4' fill='#E63B2E' stroke='#AA1100' stroke-width='2'/>
</svg>`
  },

  {
    id: 'trophy',
    label: 'トロフィー',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='trophy_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <path d='M28 12 L72 12 L72 52 Q72 72 50 74 Q28 72 28 52 Z'
        fill='url(#trophy_g1)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
  <path d='M72 20 Q88 20 86 36 Q84 48 72 48' stroke='#CC8800' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M28 20 Q12 20 14 36 Q16 48 28 48' stroke='#CC8800' stroke-width='3' fill='none' stroke-linecap='round'/>
  <rect x='40' y='74' width='20' height='12' fill='#FFCC44' stroke='#CC8800' stroke-width='2'/>
  <rect x='28' y='86' width='44' height='8' rx='3' fill='url(#trophy_g1)' stroke='#CC8800' stroke-width='3'/>
  <text x='50' y='46' font-family='Arial,sans-serif' font-size='22' font-weight='bold' fill='#CC8800' text-anchor='middle'>1</text>
</svg>`
  },

  {
    id: 'medal',
    label: 'メダル',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='medal_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <path d='M38 8 L50 8 L62 8 L70 26 L50 22 L30 26 Z' fill='#FF6B9D' stroke='#CC2266' stroke-width='2'/>
  <path d='M30 26 L50 22 L70 26 L66 42 L34 42 Z' fill='#CC2266' stroke='#AA0044' stroke-width='2'/>
  <circle cx='50' cy='66' r='26' fill='url(#medal_g1)' stroke='#CC8800' stroke-width='3'/>
  <circle cx='50' cy='66' r='20' fill='#FFDD44' stroke='#CC8800' stroke-width='1.5'/>
  <text x='50' y='72' font-family='Arial,sans-serif' font-size='20' font-weight='bold' fill='#CC8800' text-anchor='middle'>1</text>
</svg>`
  },

  {
    id: 'balloon',
    label: 'ふうせん',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='balloon_g1' x1='20%' y1='10%' x2='80%' y2='90%'>
      <stop offset='0%' stop-color='#FF9EC4'/>
      <stop offset='100%' stop-color='#FF2D6B'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='44' rx='32' ry='38' fill='url(#balloon_g1)' stroke='#CC0055' stroke-width='3'/>
  <ellipse cx='38' cy='28' rx='10' ry='8' fill='white' opacity='0.3' transform='rotate(-30 38 28)'/>
  <path d='M44 82 L50 90 L56 82' stroke='#CC0055' stroke-width='2.5' fill='none' stroke-linejoin='round'/>
  <path d='M50 90 L48 96 M50 90 L52 96' stroke='#CC0055' stroke-width='2' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'confetti',
    label: 'かみふぶき',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <rect x='46' y='8' width='8' height='14' rx='3' fill='#FF6B9D' transform='rotate(-20 50 15)'/>
  <rect x='20' y='20' width='7' height='12' rx='3' fill='#FFD700' transform='rotate(15 24 26)'/>
  <rect x='72' y='14' width='7' height='12' rx='3' fill='#00CFFF' transform='rotate(-35 76 20)'/>
  <rect x='10' y='50' width='6' height='10' rx='2' fill='#66FF99' transform='rotate(25 13 55)'/>
  <rect x='82' y='44' width='6' height='10' rx='2' fill='#FF9A3C' transform='rotate(-15 85 49)'/>
  <rect x='30' y='70' width='7' height='12' rx='3' fill='#A855F7' transform='rotate(40 34 76)'/>
  <rect x='60' y='68' width='6' height='10' rx='2' fill='#FF6B35' transform='rotate(-25 63 73)'/>
  <circle cx='55' cy='35' r='5' fill='#FFD700' stroke='#CC8800' stroke-width='2'/>
  <circle cx='22' cy='68' r='4' fill='#FF6B9D' stroke='#CC2266' stroke-width='2'/>
  <circle cx='78' cy='72' r='4' fill='#00CFFF' stroke='#0077AA' stroke-width='2'/>
  <circle cx='70' cy='38' r='3' fill='#66FF99' stroke='#00AA44' stroke-width='2'/>
  <circle cx='14' cy='32' r='3' fill='#FF9A3C' stroke='#CC6600' stroke-width='2'/>
  <path d='M40 50 L46 56 L52 44' stroke='#FF6B9D' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/>
  <path d='M18 84 L24 90 L30 80' stroke='#FFD700' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/>
  <path d='M68 82 L74 88 L80 78' stroke='#A855F7' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/>
</svg>`
  },

  {
    id: 'bomb',
    label: 'ばくだん',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='bomb_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#555566'/>
      <stop offset='100%' stop-color='#222233'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='60' r='34' fill='url(#bomb_g1)' stroke='#111122' stroke-width='3'/>
  <ellipse cx='38' cy='46' rx='8' ry='6' fill='#6666AA' opacity='0.4'/>
  <path d='M58 28 Q64 18 72 14' stroke='#888899' stroke-width='5' fill='none' stroke-linecap='round'/>
  <path d='M70 12 Q76 8 78 14 Q80 20 74 22' stroke='#FF9A3C' stroke-width='3' fill='none' stroke-linecap='round'/>
  <circle cx='76' cy='10' r='6' fill='#FF9A3C' opacity='0.8'/>
  <circle cx='80' cy='6' r='4' fill='#FFE566' opacity='0.6'/>
  <circle cx='84' cy='2' r='3' fill='#FFE566' opacity='0.4'/>
</svg>`
  },

  {
    id: 'lightning',
    label: 'かみなり',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='lightning_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <polygon points='60,6 28,54 50,54 40,94 72,46 50,46'
           fill='url(#lightning_g1)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
  <ellipse cx='56' cy='24' rx='6' ry='4' fill='white' opacity='0.4' transform='rotate(-30 56 24)'/>
</svg>`
  },

  {
    id: 'snowflake',
    label: 'ゆきのはな',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <line x1='50' y1='8' x2='50' y2='92' stroke='#88CCFF' stroke-width='4' stroke-linecap='round'/>
  <line x1='8' y1='50' x2='92' y2='50' stroke='#88CCFF' stroke-width='4' stroke-linecap='round'/>
  <line x1='21' y1='21' x2='79' y2='79' stroke='#88CCFF' stroke-width='4' stroke-linecap='round'/>
  <line x1='79' y1='21' x2='21' y2='79' stroke='#88CCFF' stroke-width='4' stroke-linecap='round'/>
  <line x1='50' y1='8' x2='42' y2='22' stroke='#88CCFF' stroke-width='3' stroke-linecap='round'/>
  <line x1='50' y1='8' x2='58' y2='22' stroke='#88CCFF' stroke-width='3' stroke-linecap='round'/>
  <line x1='50' y1='92' x2='42' y2='78' stroke='#88CCFF' stroke-width='3' stroke-linecap='round'/>
  <line x1='50' y1='92' x2='58' y2='78' stroke='#88CCFF' stroke-width='3' stroke-linecap='round'/>
  <line x1='8' y1='50' x2='22' y2='42' stroke='#88CCFF' stroke-width='3' stroke-linecap='round'/>
  <line x1='8' y1='50' x2='22' y2='58' stroke='#88CCFF' stroke-width='3' stroke-linecap='round'/>
  <line x1='92' y1='50' x2='78' y2='42' stroke='#88CCFF' stroke-width='3' stroke-linecap='round'/>
  <line x1='92' y1='50' x2='78' y2='58' stroke='#88CCFF' stroke-width='3' stroke-linecap='round'/>
  <circle cx='50' cy='50' r='8' fill='#AADDFF' stroke='#4499CC' stroke-width='2.5'/>
</svg>`
  },

  {
    id: 'diamond',
    label: 'ダイヤ',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='diamond_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#AADDFF'/>
      <stop offset='100%' stop-color='#4499EE'/>
    </linearGradient>
  </defs>
  <polygon points='50,8 90,42 50,92 10,42' fill='url(#diamond_g1)' stroke='#2277CC' stroke-width='3' stroke-linejoin='round'/>
  <polygon points='50,8 90,42 50,42' fill='#CCEEFF' opacity='0.6'/>
  <polygon points='10,42 50,42 50,92' fill='#1155AA' opacity='0.4'/>
  <polygon points='50,42 90,42 50,92' fill='#2266BB' opacity='0.3'/>
  <path d='M22 42 L50 8 L78 42' stroke='white' stroke-width='2' fill='none' opacity='0.5'/>
  <line x1='50' y1='8' x2='50' y2='92' stroke='white' stroke-width='1.5' opacity='0.3'/>
</svg>`
  },

  {
    id: 'palette',
    label: 'パレット',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='palette_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#F5ECD7'/>
      <stop offset='100%' stop-color='#D4B896'/>
    </linearGradient>
  </defs>
  <path d='M50 10 C28 10 10 28 10 50 C10 72 28 90 50 90 C58 90 66 86 70 80 C72 76 68 72 64 74 C60 76 56 74 56 70 C56 64 62 60 68 60 C80 60 90 54 90 42 C90 24 72 10 50 10 Z'
        fill='url(#palette_g1)' stroke='#886644' stroke-width='3'/>
  <circle cx='30' cy='32' r='7' fill='#FF6B9D' stroke='#CC2266' stroke-width='2'/>
  <circle cx='50' cy='22' r='7' fill='#FFD700' stroke='#CC8800' stroke-width='2'/>
  <circle cx='70' cy='32' r='7' fill='#66CCFF' stroke='#0099CC' stroke-width='2'/>
  <circle cx='76' cy='52' r='7' fill='#66FF99' stroke='#00AA44' stroke-width='2'/>
  <circle cx='24' cy='52' r='7' fill='#FF9A3C' stroke='#CC6600' stroke-width='2'/>
  <circle cx='64' cy='70' r='6' fill='#333' stroke='#111' stroke-width='2'/>
</svg>`
  },

  {
    id: 'camera',
    label: 'カメラ',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='camera_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#555566'/>
      <stop offset='100%' stop-color='#222233'/>
    </linearGradient>
  </defs>
  <rect x='8' y='32' width='84' height='56' rx='8' fill='url(#camera_g1)' stroke='#111122' stroke-width='3'/>
  <path d='M36 32 L42 18 L58 18 L64 32' fill='url(#camera_g1)' stroke='#111122' stroke-width='3' stroke-linejoin='round'/>
  <circle cx='50' cy='60' r='20' fill='#3344AA' stroke='#111122' stroke-width='3'/>
  <circle cx='50' cy='60' r='14' fill='#5566CC' stroke='#2233AA' stroke-width='2'/>
  <circle cx='50' cy='60' r='8' fill='#AABBEE'/>
  <circle cx='55' cy='55' r='3' fill='white' opacity='0.6'/>
  <circle cx='82' cy='44' r='5' fill='#FF6B9D' stroke='#CC2266' stroke-width='2'/>
</svg>`
  },

  {
    id: 'game_controller',
    label: 'ゲーム',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='game_controller_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#7B68CC'/>
      <stop offset='100%' stop-color='#4433AA'/>
    </linearGradient>
  </defs>
  <path d='M16 44 Q10 44 8 56 L6 74 Q4 86 14 88 Q24 90 30 78 L34 68 L66 68 L70 78 Q76 90 86 88 Q96 86 94 74 L92 56 Q90 44 84 44 Z'
        fill='url(#game_controller_g1)' stroke='#221188' stroke-width='3' stroke-linejoin='round'/>
  <line x1='28' y1='48' x2='28' y2='64' stroke='white' stroke-width='3.5' stroke-linecap='round'/>
  <line x1='20' y1='56' x2='36' y2='56' stroke='white' stroke-width='3.5' stroke-linecap='round'/>
  <circle cx='64' cy='52' r='5' fill='#FF6B9D' stroke='#CC2266' stroke-width='2'/>
  <circle cx='74' cy='58' r='5' fill='#66FF99' stroke='#00AA44' stroke-width='2'/>
  <circle cx='74' cy='46' r='5' fill='#FFD700' stroke='#CC8800' stroke-width='2'/>
  <circle cx='84' cy='52' r='5' fill='#66CCFF' stroke='#0099CC' stroke-width='2'/>
  <ellipse cx='50' cy='56' rx='8' ry='5' fill='#3322AA' stroke='#221188' stroke-width='1.5'/>
</svg>`
  },

  {
    id: 'headphone',
    label: 'ヘッドホン',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='headphone_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#444455'/>
      <stop offset='100%' stop-color='#222233'/>
    </linearGradient>
  </defs>
  <path d='M20 50 Q20 18 50 18 Q80 18 80 50' stroke='#222233' stroke-width='8' fill='none' stroke-linecap='round'/>
  <rect x='10' y='46' width='18' height='28' rx='8' fill='url(#headphone_g1)' stroke='#111122' stroke-width='3'/>
  <rect x='72' y='46' width='18' height='28' rx='8' fill='url(#headphone_g1)' stroke='#111122' stroke-width='3'/>
  <rect x='12' y='50' width='14' height='20' rx='6' fill='#7B68CC'/>
  <rect x='74' y='50' width='14' height='20' rx='6' fill='#7B68CC'/>
  <circle cx='19' cy='60' r='4' fill='#AABBEE' opacity='0.7'/>
  <circle cx='81' cy='60' r='4' fill='#AABBEE' opacity='0.7'/>
</svg>`
  },

  {
    id: 'book',
    label: 'ほん',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='book_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF9EC4'/>
      <stop offset='100%' stop-color='#CC2266'/>
    </linearGradient>
  </defs>
  <rect x='12' y='14' width='76' height='72' rx='4' fill='url(#book_g1)' stroke='#AA0044' stroke-width='3'/>
  <rect x='12' y='14' width='8' height='72' fill='#AA0044'/>
  <rect x='24' y='26' width='52' height='4' rx='2' fill='white' opacity='0.7'/>
  <rect x='24' y='36' width='52' height='4' rx='2' fill='white' opacity='0.7'/>
  <rect x='24' y='46' width='52' height='4' rx='2' fill='white' opacity='0.7'/>
  <rect x='24' y='56' width='40' height='4' rx='2' fill='white' opacity='0.7'/>
  <rect x='24' y='66' width='44' height='4' rx='2' fill='white' opacity='0.7'/>
</svg>`
  },

  {
    id: 'pencil',
    label: 'えんぴつ',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='pencil_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <polygon points='22,78 78,22 86,30 30,86' fill='url(#pencil_g1)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
  <polygon points='22,78 30,86 14,92' fill='#FFCC44' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
  <polygon points='14,92 22,78 18,88' fill='#333' stroke='#111' stroke-width='2'/>
  <polygon points='72,16 86,30 78,22' fill='#FF9EC4' stroke='#CC2266' stroke-width='2.5' stroke-linejoin='round'/>
  <line x1='30' y1='70' x2='70' y2='30' stroke='#CC8800' stroke-width='2' opacity='0.5'/>
</svg>`
  },

  {
    id: 'light_bulb',
    label: 'ひらめき',
    category: 'emotion',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='light_bulb_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFBB00'/>
    </linearGradient>
  </defs>
  <path d='M50 12 C32 12 18 26 18 44 C18 56 24 64 34 70 L34 78 Q34 84 40 84 L60 84 Q66 84 66 78 L66 70 C76 64 82 56 82 44 C82 26 68 12 50 12 Z'
        fill='url(#light_bulb_g1)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
  <rect x='40' y='84' width='20' height='6' rx='3' fill='#AAAAAA' stroke='#888888' stroke-width='2'/>
  <rect x='42' y='90' width='16' height='5' rx='2.5' fill='#888888' stroke='#666666' stroke-width='2'/>
  <ellipse cx='40' cy='36' rx='10' ry='8' fill='white' opacity='0.4' transform='rotate(-30 40 36)'/>
  <line x1='50' y1='4' x2='50' y2='10' stroke='#FFEE44' stroke-width='3' stroke-linecap='round'/>
  <line x1='20' y1='14' x2='26' y2='20' stroke='#FFEE44' stroke-width='3' stroke-linecap='round'/>
  <line x1='80' y1='14' x2='74' y2='20' stroke='#FFEE44' stroke-width='3' stroke-linecap='round'/>
  <line x1='8' y1='44' x2='14' y2='44' stroke='#FFEE44' stroke-width='3' stroke-linecap='round'/>
  <line x1='92' y1='44' x2='86' y2='44' stroke='#FFEE44' stroke-width='3' stroke-linecap='round'/>
</svg>`
  },


  // ===== 動物カテゴリ 追加77種 =====

  // --- ペット ---
  {
    id: 'dog',
    label: 'いぬ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <ellipse cx='34' cy='28' rx='10' ry='18' fill='#C8934A' stroke='#8B5E2A' stroke-width='3'/>
  <ellipse cx='66' cy='28' rx='10' ry='18' fill='#C8934A' stroke='#8B5E2A' stroke-width='3'/>
  <ellipse cx='50' cy='58' rx='32' ry='28' fill='#C8934A' stroke='#8B5E2A' stroke-width='3'/>
  <ellipse cx='50' cy='46' rx='22' ry='20' fill='#C8934A' stroke='#8B5E2A' stroke-width='3'/>
  <ellipse cx='42' cy='43' rx='5' ry='6' fill='#111'/>
  <ellipse cx='58' cy='43' rx='5' ry='6' fill='#111'/>
  <circle cx='43' cy='41' r='2' fill='white'/>
  <circle cx='59' cy='41' r='2' fill='white'/>
  <ellipse cx='50' cy='54' rx='5' ry='3.5' fill='#333'/>
  <ellipse cx='50' cy='58' rx='14' ry='10' fill='#E8B07A'/>
  <path d='M44 60 Q50 66 56 60' stroke='#8B5E2A' stroke-width='2' fill='none' stroke-linecap='round'/>
  <path d='M28 54 L16 52' stroke='#8B5E2A' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M28 57 L16 57' stroke='#8B5E2A' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M72 54 L84 52' stroke='#8B5E2A' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M72 57 L84 57' stroke='#8B5E2A' stroke-width='1.5' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'hamster',
    label: 'ハムスター',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <ellipse cx='50' cy='60' rx='38' ry='30' fill='#F4C68A' stroke='#C8844A' stroke-width='3'/>
  <ellipse cx='50' cy='46' rx='26' ry='22' fill='#F4C68A' stroke='#C8844A' stroke-width='3'/>
  <circle cx='26' cy='34' r='12' fill='#F4C68A' stroke='#C8844A' stroke-width='3'/>
  <circle cx='74' cy='34' r='12' fill='#F4C68A' stroke='#C8844A' stroke-width='3'/>
  <circle cx='26' cy='34' r='7' fill='#F9B0A0'/>
  <circle cx='74' cy='34' r='7' fill='#F9B0A0'/>
  <ellipse cx='42' cy='44' rx='5' ry='6' fill='#222'/>
  <ellipse cx='58' cy='44' rx='5' ry='6' fill='#222'/>
  <circle cx='43' cy='42' r='2' fill='white'/>
  <circle cx='59' cy='42' r='2' fill='white'/>
  <ellipse cx='50' cy='54' rx='8' ry='5' fill='#FFBBAA'/>
  <ellipse cx='50' cy='53' rx='4' ry='2' fill='#FF8888'/>
  <path d='M42 56 Q50 62 58 56' stroke='#C8844A' stroke-width='2' fill='none' stroke-linecap='round'/>
  <path d='M28 56 L16 54 M28 60 L16 60' stroke='#C8844A' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M72 56 L84 54 M72 60 L84 60' stroke='#C8844A' stroke-width='1.5' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'panda',
    label: 'パンダ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <circle cx='28' cy='28' r='14' fill='#111' stroke='#000' stroke-width='2'/>
  <circle cx='72' cy='28' r='14' fill='#111' stroke='#000' stroke-width='2'/>
  <circle cx='50' cy='58' r='36' fill='white' stroke='#AAAAAA' stroke-width='3'/>
  <ellipse cx='50' cy='64' rx='16' ry='12' fill='#EEE'/>
  <ellipse cx='38' cy='48' rx='9' ry='10' fill='#111'/>
  <ellipse cx='62' cy='48' rx='9' ry='10' fill='#111'/>
  <circle cx='38' cy='47' r='5' fill='#333'/>
  <circle cx='62' cy='47' r='5' fill='#333'/>
  <circle cx='39' cy='45' r='2' fill='white'/>
  <circle cx='63' cy='45' r='2' fill='white'/>
  <ellipse cx='50' cy='62' rx='5' ry='3' fill='#888'/>
  <path d='M44 68 Q50 74 56 68' stroke='#888' stroke-width='2.5' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'koala',
    label: 'コアラ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <circle cx='22' cy='32' r='16' fill='#AABBCC' stroke='#7788AA' stroke-width='3'/>
  <circle cx='78' cy='32' r='16' fill='#AABBCC' stroke='#7788AA' stroke-width='3'/>
  <circle cx='22' cy='32' r='10' fill='#CCDDEE'/>
  <circle cx='78' cy='32' r='10' fill='#CCDDEE'/>
  <circle cx='50' cy='58' r='34' fill='#AABBCC' stroke='#7788AA' stroke-width='3'/>
  <ellipse cx='50' cy='66' rx='18' ry='14' fill='#CCDDEE'/>
  <ellipse cx='40' cy='50' rx='7' ry='8' fill='#555'/>
  <ellipse cx='60' cy='50' rx='7' ry='8' fill='#555'/>
  <circle cx='41' cy='48' r='2.5' fill='white'/>
  <circle cx='61' cy='48' r='2.5' fill='white'/>
  <ellipse cx='50' cy='60' rx='8' ry='6' fill='#7788AA'/>
  <path d='M44 68 Q50 74 56 68' stroke='#7788AA' stroke-width='2.5' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'mouse',
    label: 'ネズミ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <ellipse cx='34' cy='26' rx='12' ry='16' fill='#CCBBCC' stroke='#998899' stroke-width='3'/>
  <ellipse cx='66' cy='26' rx='12' ry='16' fill='#CCBBCC' stroke='#998899' stroke-width='3'/>
  <ellipse cx='34' cy='26' rx='7' ry='10' fill='#FFAABB'/>
  <ellipse cx='66' cy='26' rx='7' ry='10' fill='#FFAABB'/>
  <ellipse cx='50' cy='58' rx='30' ry='28' fill='#CCBBCC' stroke='#998899' stroke-width='3'/>
  <ellipse cx='50' cy='46' rx='20' ry='18' fill='#CCBBCC' stroke='#998899' stroke-width='3'/>
  <circle cx='42' cy='44' r='6' fill='#222'/>
  <circle cx='58' cy='44' r='6' fill='#222'/>
  <circle cx='43' cy='42' r='2' fill='white'/>
  <circle cx='59' cy='42' r='2' fill='white'/>
  <ellipse cx='50' cy='54' rx='4' ry='3' fill='#FF99AA'/>
  <path d='M44 58 Q50 64 56 58' stroke='#998899' stroke-width='2' fill='none' stroke-linecap='round'/>
  <path d='M74 70 Q82 62 90 70 Q94 76 90 80' stroke='#998899' stroke-width='2.5' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'pig',
    label: 'ぶた',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='pig_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFB8CC'/>
      <stop offset='100%' stop-color='#FF88AA'/>
    </linearGradient>
  </defs>
  <circle cx='28' cy='30' r='12' fill='url(#pig_g1)' stroke='#CC6688' stroke-width='3'/>
  <circle cx='72' cy='30' r='12' fill='url(#pig_g1)' stroke='#CC6688' stroke-width='3'/>
  <circle cx='50' cy='56' r='36' fill='url(#pig_g1)' stroke='#CC6688' stroke-width='3'/>
  <ellipse cx='50' cy='58' rx='14' ry='10' fill='#FF99BB'/>
  <circle cx='47' cy='57' r='3' fill='#CC6688'/>
  <circle cx='53' cy='57' r='3' fill='#CC6688'/>
  <ellipse cx='40' cy='46' rx='6' ry='7' fill='#333'/>
  <ellipse cx='60' cy='46' rx='6' ry='7' fill='#333'/>
  <circle cx='41' cy='44' r='2' fill='white'/>
  <circle cx='61' cy='44' r='2' fill='white'/>
  <path d='M42 66 Q50 72 58 66' stroke='#CC6688' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <ellipse cx='28' cy='46' rx='5' ry='3' fill='#FFAABB' opacity='0.6'/>
  <ellipse cx='72' cy='46' rx='5' ry='3' fill='#FFAABB' opacity='0.6'/>
</svg>`
  },

  {
    id: 'frog',
    label: 'かえる',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='frog_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#66DD66'/>
      <stop offset='100%' stop-color='#33AA33'/>
    </linearGradient>
  </defs>
  <circle cx='28' cy='34' r='14' fill='url(#frog_g1)' stroke='#228822' stroke-width='3'/>
  <circle cx='72' cy='34' r='14' fill='url(#frog_g1)' stroke='#228822' stroke-width='3'/>
  <circle cx='50' cy='60' r='34' fill='url(#frog_g1)' stroke='#228822' stroke-width='3'/>
  <ellipse cx='50' cy='68' rx='20' ry='12' fill='#CCFFCC'/>
  <circle cx='28' cy='32' r='8' fill='#111'/>
  <circle cx='72' cy='32' r='8' fill='#111'/>
  <circle cx='29' cy='30' r='3' fill='white'/>
  <circle cx='73' cy='30' r='3' fill='white'/>
  <path d='M38 60 Q50 68 62 60' stroke='#228822' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M28 56 L14 62' stroke='#228822' stroke-width='2.5' stroke-linecap='round'/>
  <path d='M72 56 L86 62' stroke='#228822' stroke-width='2.5' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'turtle',
    label: 'かめ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='turtle_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#66BB66'/>
      <stop offset='100%' stop-color='#337733'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='56' rx='36' ry='28' fill='url(#turtle_g1)' stroke='#225522' stroke-width='3'/>
  <ellipse cx='50' cy='52' rx='28' ry='22' fill='#449944' stroke='#225522' stroke-width='2'/>
  <path d='M36 42 L50 30 L64 42 M36 62 L50 74 L64 62 M22 52 L36 44 M78 52 L64 44' stroke='#225522' stroke-width='2' fill='none'/>
  <ellipse cx='50' cy='34' rx='10' ry='8' fill='#88CC88' stroke='#225522' stroke-width='2.5'/>
  <circle cx='46' cy='32' r='3' fill='#111'/>
  <circle cx='54' cy='32' r='3' fill='#111'/>
  <circle cx='47' cy='31' r='1' fill='white'/>
  <circle cx='55' cy='31' r='1' fill='white'/>
  <ellipse cx='18' cy='56' rx='10' ry='7' fill='#88CC88' stroke='#225522' stroke-width='2'/>
  <ellipse cx='82' cy='56' rx='10' ry='7' fill='#88CC88' stroke='#225522' stroke-width='2'/>
  <ellipse cx='34' cy='80' rx='10' ry='6' fill='#88CC88' stroke='#225522' stroke-width='2'/>
  <ellipse cx='66' cy='80' rx='10' ry='6' fill='#88CC88' stroke='#225522' stroke-width='2'/>
</svg>`
  },

  {
    id: 'chick',
    label: 'ひよこ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='chick_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFBB00'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='64' rx='30' ry='26' fill='url(#chick_g1)' stroke='#CC8800' stroke-width='3'/>
  <circle cx='50' cy='40' r='22' fill='url(#chick_g1)' stroke='#CC8800' stroke-width='3'/>
  <circle cx='42' cy='36' r='6' fill='#111'/>
  <circle cx='58' cy='36' r='6' fill='#111'/>
  <circle cx='43' cy='34' r='2' fill='white'/>
  <circle cx='59' cy='34' r='2' fill='white'/>
  <path d='M44 46 L50 52 L56 46' fill='#FF9900' stroke='#CC6600' stroke-width='2' stroke-linejoin='round'/>
  <path d='M38 18 L42 10 L46 18' fill='url(#chick_g1)' stroke='#CC8800' stroke-width='2' stroke-linejoin='round'/>
  <ellipse cx='28' cy='72' rx='8' ry='5' fill='#FF9900' stroke='#CC6600' stroke-width='2'/>
  <ellipse cx='72' cy='72' rx='8' ry='5' fill='#FF9900' stroke='#CC6600' stroke-width='2'/>
</svg>`
  },

  {
    id: 'goldfish',
    label: 'きんぎょ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='goldfish_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF8844'/>
      <stop offset='100%' stop-color='#FF4422'/>
    </linearGradient>
  </defs>
  <path d='M60 50 Q90 30 94 18 Q86 26 78 24 Q88 14 88 6 Q76 12 72 22 Q70 14 64 12 Q66 24 60 30 Z'
        fill='url(#goldfish_g1)' stroke='#CC2200' stroke-width='2' stroke-linejoin='round'/>
  <ellipse cx='40' cy='52' rx='28' ry='22' fill='url(#goldfish_g1)' stroke='#CC2200' stroke-width='3'/>
  <path d='M20 46 Q8 36 6 28 Q16 36 14 48 Z' fill='#FF6633' stroke='#CC2200' stroke-width='2'/>
  <path d='M20 58 Q8 68 6 76 Q16 68 14 56 Z' fill='#FF6633' stroke='#CC2200' stroke-width='2'/>
  <circle cx='42' cy='46' r='7' fill='white'/>
  <circle cx='42' cy='47' r='4' fill='#222'/>
  <circle cx='43' cy='45' r='1.5' fill='white'/>
  <path d='M30 52 Q40 58 50 52' stroke='#CC2200' stroke-width='1.5' fill='none' stroke-linecap='round'/>
</svg>`
  },

  // --- 鳥 ---
  {
    id: 'penguin',
    label: 'ペンギン',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <ellipse cx='50' cy='62' rx='28' ry='32' fill='#222233' stroke='#111122' stroke-width='3'/>
  <ellipse cx='50' cy='68' rx='18' ry='22' fill='white'/>
  <circle cx='50' cy='34' r='20' fill='#222233' stroke='#111122' stroke-width='3'/>
  <ellipse cx='50' cy='36' rx='12' ry='14' fill='white'/>
  <circle cx='44' cy='30' r='5' fill='#222233'/>
  <circle cx='56' cy='30' r='5' fill='#222233'/>
  <circle cx='45' cy='28' r='2' fill='white'/>
  <circle cx='57' cy='28' r='2' fill='white'/>
  <path d='M44 42 L50 46 L56 42' fill='#FF9900' stroke='#CC6600' stroke-width='2' stroke-linejoin='round'/>
  <ellipse cx='32' cy='66' rx='10' ry='5' fill='#222233' stroke='#111122' stroke-width='2' transform='rotate(-30 32 66)'/>
  <ellipse cx='68' cy='66' rx='10' ry='5' fill='#222233' stroke='#111122' stroke-width='2' transform='rotate(30 68 66)'/>
  <ellipse cx='40' cy='90' rx='8' ry='4' fill='#FF9900' stroke='#CC6600' stroke-width='2'/>
  <ellipse cx='60' cy='90' rx='8' ry='4' fill='#FF9900' stroke='#CC6600' stroke-width='2'/>
</svg>`
  },

  {
    id: 'owl',
    label: 'フクロウ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='owl_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#C8944A'/>
      <stop offset='100%' stop-color='#8B5E2A'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='62' rx='30' ry='32' fill='url(#owl_g1)' stroke='#5C3D1E' stroke-width='3'/>
  <ellipse cx='50' cy='46' rx='22' ry='20' fill='url(#owl_g1)' stroke='#5C3D1E' stroke-width='3'/>
  <polygon points='34,28 28,14 42,24' fill='#8B5E2A' stroke='#5C3D1E' stroke-width='2' stroke-linejoin='round'/>
  <polygon points='66,28 72,14 58,24' fill='#8B5E2A' stroke='#5C3D1E' stroke-width='2' stroke-linejoin='round'/>
  <circle cx='40' cy='44' r='10' fill='#FFE566' stroke='#5C3D1E' stroke-width='2'/>
  <circle cx='60' cy='44' r='10' fill='#FFE566' stroke='#5C3D1E' stroke-width='2'/>
  <circle cx='40' cy='44' r='6' fill='#333'/>
  <circle cx='60' cy='44' r='6' fill='#333'/>
  <circle cx='41' cy='42' r='2' fill='white'/>
  <circle cx='61' cy='42' r='2' fill='white'/>
  <path d='M44 56 L50 60 L56 56' fill='#FF9900' stroke='#CC6600' stroke-width='2' stroke-linejoin='round'/>
  <ellipse cx='50' cy='70' rx='16' ry='10' fill='#E8B07A'/>
</svg>`
  },

  {
    id: 'duck',
    label: 'アヒル',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='duck_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFB300'/>
    </linearGradient>
  </defs>
  <ellipse cx='48' cy='66' rx='32' ry='24' fill='url(#duck_g1)' stroke='#CC8800' stroke-width='3'/>
  <circle cx='42' cy='38' r='20' fill='url(#duck_g1)' stroke='#CC8800' stroke-width='3'/>
  <path d='M58 36 Q70 32 74 38 Q72 46 58 44 Z' fill='#FF9900' stroke='#CC6600' stroke-width='2' stroke-linejoin='round'/>
  <circle cx='38' cy='32' r='6' fill='#333'/>
  <circle cx='39' cy='30' r='2' fill='white'/>
  <path d='M32 80 Q48 90 64 80' stroke='#CC8800' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <ellipse cx='76' cy='62' rx='14' ry='8' fill='#FFD700' stroke='#CC8800' stroke-width='2' transform='rotate(-20 76 62)'/>
</svg>`
  },

  // --- 海洋 ---
  {
    id: 'whale',
    label: 'くじら',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='whale_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#4488CC'/>
      <stop offset='100%' stop-color='#226699'/>
    </linearGradient>
  </defs>
  <path d='M10 55 Q10 30 40 28 Q70 26 82 40 Q94 52 90 68 L76 68 Q70 82 60 82 L20 78 Q6 74 10 55 Z'
        fill='url(#whale_g1)' stroke='#114477' stroke-width='3' stroke-linejoin='round'/>
  <path d='M76 68 L88 56 L94 68 Z' fill='url(#whale_g1)' stroke='#114477' stroke-width='2.5' stroke-linejoin='round'/>
  <ellipse cx='26' cy='76' rx='20' ry='8' fill='white'/>
  <circle cx='64' cy='38' r='7' fill='#225577'/>
  <circle cx='65' cy='36' r='2.5' fill='white'/>
  <path d='M60 46 Q54 52 56 58' stroke='white' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M50 22 Q52 14 50 8' stroke='#88CCFF' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M50 8 Q44 4 48 10' stroke='#88CCFF' stroke-width='2' fill='none' stroke-linecap='round'/>
  <path d='M50 8 Q56 4 52 10' stroke='#88CCFF' stroke-width='2' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'octopus',
    label: 'タコ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='octopus_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF88AA'/>
      <stop offset='100%' stop-color='#CC2266'/>
    </linearGradient>
  </defs>
  <path d='M20 70 Q16 84 22 90 Q28 84 24 70' fill='url(#octopus_g1)' stroke='#AA0044' stroke-width='2'/>
  <path d='M34 74 Q32 90 38 94 Q42 88 40 74' fill='url(#octopus_g1)' stroke='#AA0044' stroke-width='2'/>
  <path d='M50 76 Q50 92 56 94 Q58 88 54 76' fill='url(#octopus_g1)' stroke='#AA0044' stroke-width='2'/>
  <path d='M64 74 Q66 90 72 92 Q74 84 68 74' fill='url(#octopus_g1)' stroke='#AA0044' stroke-width='2'/>
  <path d='M78 68 Q82 82 80 90 Q86 84 84 68' fill='url(#octopus_g1)' stroke='#AA0044' stroke-width='2'/>
  <ellipse cx='50' cy='52' rx='36' ry='28' fill='url(#octopus_g1)' stroke='#AA0044' stroke-width='3'/>
  <circle cx='40' cy='44' r='7' fill='white'/>
  <circle cx='60' cy='44' r='7' fill='white'/>
  <circle cx='40' cy='45' r='4' fill='#333'/>
  <circle cx='60' cy='45' r='4' fill='#333'/>
  <circle cx='41' cy='43' r='1.5' fill='white'/>
  <circle cx='61' cy='43' r='1.5' fill='white'/>
  <path d='M40 58 Q50 64 60 58' stroke='#AA0044' stroke-width='2.5' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'crab',
    label: 'カニ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='crab_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF6633'/>
      <stop offset='100%' stop-color='#CC2200'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='58' rx='30' ry='22' fill='url(#crab_g1)' stroke='#AA1100' stroke-width='3'/>
  <path d='M22 52 L8 44 M22 58 L8 60 M22 64 L10 72' stroke='#AA1100' stroke-width='4' stroke-linecap='round'/>
  <path d='M78 52 L92 44 M78 58 L92 60 M78 64 L90 72' stroke='#AA1100' stroke-width='4' stroke-linecap='round'/>
  <path d='M24 46 Q18 34 12 32 Q10 38 14 42 L24 46 Z' fill='url(#crab_g1)' stroke='#AA1100' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M76 46 Q82 34 88 32 Q90 38 86 42 L76 46 Z' fill='url(#crab_g1)' stroke='#AA1100' stroke-width='2.5' stroke-linejoin='round'/>
  <circle cx='38' cy='50' r='7' fill='white' stroke='#AA1100' stroke-width='2'/>
  <circle cx='62' cy='50' r='7' fill='white' stroke='#AA1100' stroke-width='2'/>
  <circle cx='38' cy='51' r='4' fill='#333'/>
  <circle cx='62' cy='51' r='4' fill='#333'/>
  <circle cx='39' cy='49' r='1.5' fill='white'/>
  <circle cx='63' cy='49' r='1.5' fill='white'/>
  <path d='M40 64 Q50 70 60 64' stroke='#AA1100' stroke-width='2.5' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'jellyfish',
    label: 'くらげ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='jellyfish_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#BBAAFF'/>
      <stop offset='100%' stop-color='#7755CC'/>
    </linearGradient>
  </defs>
  <path d='M10 48 Q10 10 50 10 Q90 10 90 48 Q70 44 50 48 Q30 44 10 48 Z'
        fill='url(#jellyfish_g1)' stroke='#5533AA' stroke-width='3'/>
  <ellipse cx='50' cy='40' rx='30' ry='20' fill='#CCBBFF' opacity='0.5'/>
  <path d='M26 48 Q22 64 24 80' stroke='#9977EE' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M38 48 Q36 66 40 84' stroke='#9977EE' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M50 48 Q50 68 52 88' stroke='#9977EE' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M62 48 Q64 66 60 84' stroke='#9977EE' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M74 48 Q78 64 76 80' stroke='#9977EE' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <circle cx='42' cy='38' r='4' fill='#333' opacity='0.6'/>
  <circle cx='58' cy='38' r='4' fill='#333' opacity='0.6'/>
  <circle cx='43' cy='37' r='1.5' fill='white' opacity='0.8'/>
  <circle cx='59' cy='37' r='1.5' fill='white' opacity='0.8'/>
</svg>`
  },

  {
    id: 'starfish',
    label: 'ヒトデ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='starfish_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF8844'/>
      <stop offset='100%' stop-color='#FF4422'/>
    </linearGradient>
  </defs>
  <polygon points='50,6 61,40 96,40 68,60 79,94 50,74 21,94 32,60 4,40 39,40'
           fill='url(#starfish_g1)' stroke='#CC2200' stroke-width='3' stroke-linejoin='round'/>
  <circle cx='50' cy='50' r='12' fill='#FF6633' stroke='#CC2200' stroke-width='2'/>
  <circle cx='50' cy='26' r='4' fill='#FFAA88'/>
  <circle cx='74' cy='46' r='4' fill='#FFAA88'/>
  <circle cx='64' cy='78' r='4' fill='#FFAA88'/>
  <circle cx='36' cy='78' r='4' fill='#FFAA88'/>
  <circle cx='26' cy='46' r='4' fill='#FFAA88'/>
</svg>`
  },

  // --- 虫 ---
  {
    id: 'butterfly',
    label: 'チョウ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='butterfly_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF9EC4'/>
      <stop offset='100%' stop-color='#CC44AA'/>
    </linearGradient>
    <linearGradient id='butterfly_g2' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFD700'/>
      <stop offset='100%' stop-color='#FF8C00'/>
    </linearGradient>
  </defs>
  <path d='M50 50 Q30 20 10 28 Q6 46 20 52 Q34 58 50 50 Z' fill='url(#butterfly_g1)' stroke='#AA2288' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M50 50 Q70 20 90 28 Q94 46 80 52 Q66 58 50 50 Z' fill='url(#butterfly_g1)' stroke='#AA2288' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M50 50 Q32 62 18 74 Q22 86 36 80 Q50 72 50 50 Z' fill='url(#butterfly_g2)' stroke='#CC6600' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M50 50 Q68 62 82 74 Q78 86 64 80 Q50 72 50 50 Z' fill='url(#butterfly_g2)' stroke='#CC6600' stroke-width='2.5' stroke-linejoin='round'/>
  <ellipse cx='50' cy='50' rx='4' ry='18' fill='#333' stroke='#111' stroke-width='2'/>
  <path d='M48 34 Q44 26 42 20' stroke='#333' stroke-width='2' fill='none' stroke-linecap='round'/>
  <path d='M52 34 Q56 26 58 20' stroke='#333' stroke-width='2' fill='none' stroke-linecap='round'/>
  <circle cx='42' cy='19' r='3' fill='#333'/>
  <circle cx='58' cy='19' r='3' fill='#333'/>
</svg>`
  },

  {
    id: 'ladybug',
    label: 'てんとうむし',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='ladybug_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF4422'/>
      <stop offset='100%' stop-color='#CC1100'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='62' rx='34' ry='28' fill='url(#ladybug_g1)' stroke='#880000' stroke-width='3'/>
  <circle cx='50' cy='36' r='16' fill='#222' stroke='#111' stroke-width='3'/>
  <line x1='50' y1='36' x2='50' y2='90' stroke='#880000' stroke-width='3'/>
  <circle cx='34' cy='56' r='7' fill='#880000'/>
  <circle cx='66' cy='56' r='7' fill='#880000'/>
  <circle cx='34' cy='74' r='6' fill='#880000'/>
  <circle cx='66' cy='74' r='6' fill='#880000'/>
  <circle cx='50' cy='68' r='6' fill='#880000'/>
  <circle cx='38' cy='32' r='4' fill='#333'/>
  <circle cx='62' cy='32' r='4' fill='#333'/>
  <circle cx='39' cy='31' r='1.5' fill='white'/>
  <circle cx='63' cy='31' r='1.5' fill='white'/>
</svg>`
  },

  {
    id: 'bee',
    label: 'ミツバチ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='bee_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='60' rx='22' ry='28' fill='url(#bee_g1)' stroke='#CC8800' stroke-width='3'/>
  <path d='M28 52 Q28 40 50 40 Q72 40 72 52' stroke='#CC8800' stroke-width='6' fill='none'/>
  <path d='M28 62 Q28 50 50 50 Q72 50 72 62' stroke='#CC8800' stroke-width='6' fill='none'/>
  <path d='M28 72 Q28 60 50 60 Q72 60 72 72' stroke='#CC8800' stroke-width='6' fill='none'/>
  <ellipse cx='50' cy='34' rx='14' ry='12' fill='url(#bee_g1)' stroke='#CC8800' stroke-width='3'/>
  <circle cx='44' cy='30' r='4' fill='#333'/>
  <circle cx='56' cy='30' r='4' fill='#333'/>
  <circle cx='45' cy='29' r='1.5' fill='white'/>
  <circle cx='57' cy='29' r='1.5' fill='white'/>
  <ellipse cx='28' cy='44' rx='14' ry='8' fill='#DDEEFF' stroke='#8899BB' stroke-width='2' opacity='0.8' transform='rotate(-30 28 44)'/>
  <ellipse cx='72' cy='44' rx='14' ry='8' fill='#DDEEFF' stroke='#8899BB' stroke-width='2' opacity='0.8' transform='rotate(30 72 44)'/>
  <line x1='44' y1='22' x2='42' y2='14' stroke='#333' stroke-width='2' stroke-linecap='round'/>
  <line x1='56' y1='22' x2='58' y2='14' stroke='#333' stroke-width='2' stroke-linecap='round'/>
  <circle cx='42' cy='13' r='3' fill='#333'/>
  <circle cx='58' cy='13' r='3' fill='#333'/>
</svg>`
  },

  {
    id: 'snail',
    label: 'カタツムリ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='snail_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#C8944A'/>
      <stop offset='100%' stop-color='#8B5E2A'/>
    </linearGradient>
  </defs>
  <path d='M8 72 Q8 58 20 56 L70 56 Q80 56 80 68 Q80 80 68 82 L12 82 Q6 80 8 72 Z'
        fill='#88BB66' stroke='#447733' stroke-width='3' stroke-linejoin='round'/>
  <path d='M54 56 Q54 18 86 18 Q94 18 94 34 Q94 50 78 52 Q66 54 60 56' fill='url(#snail_g1)' stroke='#5C3D1E' stroke-width='3' stroke-linejoin='round'/>
  <path d='M72 24 Q80 24 80 34 Q80 44 70 46' stroke='#5C3D1E' stroke-width='2' fill='none' stroke-linecap='round'/>
  <circle cx='20' cy='52' r='5' fill='#88BB66' stroke='#447733' stroke-width='2'/>
  <circle cx='32' cy='52' r='5' fill='#88BB66' stroke='#447733' stroke-width='2'/>
  <circle cx='20' cy='46' r='3' fill='#333'/>
  <circle cx='32' cy='46' r='3' fill='#333'/>
  <circle cx='21' cy='45' r='1' fill='white'/>
  <circle cx='33' cy='45' r='1' fill='white'/>
</svg>`
  },

  {
    id: 'beetle',
    label: 'カブトムシ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='beetle_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#554422'/>
      <stop offset='100%' stop-color='#221100'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='64' rx='28' ry='24' fill='url(#beetle_g1)' stroke='#110000' stroke-width='3'/>
  <line x1='50' y1='44' x2='50' y2='88' stroke='#110000' stroke-width='2.5'/>
  <ellipse cx='50' cy='44' rx='18' ry='14' fill='url(#beetle_g1)' stroke='#110000' stroke-width='3'/>
  <path d='M50 30 L42 10 Q38 6 40 14 L46 30' fill='#443311' stroke='#110000' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M50 30 L58 10 Q62 6 60 14 L54 30' fill='#443311' stroke='#110000' stroke-width='2.5' stroke-linejoin='round'/>
  <circle cx='42' cy='40' r='5' fill='#333'/>
  <circle cx='58' cy='40' r='5' fill='#333'/>
  <circle cx='43' cy='39' r='2' fill='white'/>
  <circle cx='59' cy='39' r='2' fill='white'/>
  <path d='M22 56 L8 48 M22 62 L8 62 M22 68 L10 74' stroke='#110000' stroke-width='3' stroke-linecap='round'/>
  <path d='M78 56 L92 48 M78 62 L92 62 M78 68 L90 74' stroke='#110000' stroke-width='3' stroke-linecap='round'/>
</svg>`
  },

  // --- 野生・架空 ---
  {
    id: 'fox',
    label: 'キツネ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='fox_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF8844'/>
      <stop offset='100%' stop-color='#CC4400'/>
    </linearGradient>
  </defs>
  <polygon points='24,36 12,8 36,28' fill='url(#fox_g1)' stroke='#882200' stroke-width='3' stroke-linejoin='round'/>
  <polygon points='76,36 88,8 64,28' fill='url(#fox_g1)' stroke='#882200' stroke-width='3' stroke-linejoin='round'/>
  <polygon points='24,36 12,8 36,28' fill='#FFCCAA' stroke='none'/>
  <polygon points='76,36 88,8 64,28' fill='#FFCCAA' stroke='none'/>
  <ellipse cx='50' cy='56' rx='32' ry='26' fill='url(#fox_g1)' stroke='#882200' stroke-width='3'/>
  <ellipse cx='50' cy='44' rx='22' ry='20' fill='url(#fox_g1)' stroke='#882200' stroke-width='3'/>
  <ellipse cx='50' cy='60' rx='16' ry='12' fill='#FFCCAA'/>
  <ellipse cx='42' cy='44' rx='5' ry='6' fill='#222'/>
  <ellipse cx='58' cy='44' rx='5' ry='6' fill='#222'/>
  <circle cx='43' cy='42' r='2' fill='white'/>
  <circle cx='59' cy='42' r='2' fill='white'/>
  <ellipse cx='50' cy='54' rx='4' ry='3' fill='#FF6633'/>
  <path d='M44 60 Q50 66 56 60' stroke='#882200' stroke-width='2' fill='none' stroke-linecap='round'/>
  <path d='M28 56 L16 52 M28 60 L16 60' stroke='#882200' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M72 56 L84 52 M72 60 L84 60' stroke='#882200' stroke-width='1.5' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'elephant',
    label: 'ゾウ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='elephant_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#AABBCC'/>
      <stop offset='100%' stop-color='#7788AA'/>
    </linearGradient>
  </defs>
  <ellipse cx='18' cy='38' rx='14' ry='20' fill='url(#elephant_g1)' stroke='#556677' stroke-width='3'/>
  <ellipse cx='82' cy='38' rx='14' ry='20' fill='url(#elephant_g1)' stroke='#556677' stroke-width='3'/>
  <ellipse cx='50' cy='52' rx='36' ry='30' fill='url(#elephant_g1)' stroke='#556677' stroke-width='3'/>
  <ellipse cx='50' cy='42' rx='26' ry='22' fill='url(#elephant_g1)' stroke='#556677' stroke-width='3'/>
  <path d='M38 62 Q32 72 30 82 Q30 90 36 90 Q42 90 44 82 Q44 72 42 62' fill='url(#elephant_g1)' stroke='#556677' stroke-width='2.5' stroke-linejoin='round'/>
  <circle cx='40' cy='40' r='7' fill='#333'/>
  <circle cx='60' cy='40' r='7' fill='#333'/>
  <circle cx='41' cy='38' r='2.5' fill='white'/>
  <circle cx='61' cy='38' r='2.5' fill='white'/>
  <path d='M44 56 Q50 62 56 56' stroke='#556677' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <ellipse cx='26' cy='52' rx='6' ry='3' fill='#CCDDEE' opacity='0.5'/>
  <ellipse cx='74' cy='52' rx='6' ry='3' fill='#CCDDEE' opacity='0.5'/>
</svg>`
  },

  {
    id: 'lion',
    label: 'ライオン',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='lion_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFCC44'/>
      <stop offset='100%' stop-color='#CC8800'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='52' r='38' fill='#CC7700' stroke='#884400' stroke-width='4'/>
  <circle cx='50' cy='52' r='28' fill='url(#lion_g1)' stroke='#884400' stroke-width='3'/>
  <ellipse cx='50' cy='60' rx='16' ry='12' fill='#FFDDAA'/>
  <circle cx='40' cy='48' r='7' fill='#333'/>
  <circle cx='60' cy='48' r='7' fill='#333'/>
  <circle cx='41' cy='46' r='2.5' fill='white'/>
  <circle cx='61' cy='46' r='2.5' fill='white'/>
  <ellipse cx='50' cy='58' rx='6' ry='4' fill='#CC8844'/>
  <path d='M42 64 Q50 70 58 64' stroke='#884400' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M28 56 L14 52 M28 60 L14 60' stroke='#884400' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M72 56 L86 52 M72 60 L86 60' stroke='#884400' stroke-width='1.5' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'giraffe',
    label: 'キリン',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='giraffe_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFDD66'/>
      <stop offset='100%' stop-color='#FFAA22'/>
    </linearGradient>
  </defs>
  <rect x='42' y='30' width='16' height='44' rx='8' fill='url(#giraffe_g1)' stroke='#CC8800' stroke-width='3'/>
  <ellipse cx='50' cy='26' rx='18' ry='16' fill='url(#giraffe_g1)' stroke='#CC8800' stroke-width='3'/>
  <circle cx='50' cy='14' r='6' fill='url(#giraffe_g1)' stroke='#CC8800' stroke-width='2'/>
  <ellipse cx='44' cy='74' rx='6' ry='14' fill='url(#giraffe_g1)' stroke='#CC8800' stroke-width='2'/>
  <ellipse cx='56' cy='74' rx='6' ry='14' fill='url(#giraffe_g1)' stroke='#CC8800' stroke-width='2'/>
  <circle cx='44' cy='20' r='5' fill='#333'/>
  <circle cx='56' cy='20' r='5' fill='#333'/>
  <circle cx='45' cy='19' r='2' fill='white'/>
  <circle cx='57' cy='19' r='2' fill='white'/>
  <ellipse cx='52' cy='30' rx='3' ry='2' fill='#CC8800'/>
  <circle cx='48' cy='46' r='5' fill='#CC8822' opacity='0.5'/>
  <circle cx='54' cy='58' r='4' fill='#CC8822' opacity='0.5'/>
  <circle cx='47' cy='68' r='3' fill='#CC8822' opacity='0.5'/>
</svg>`
  },

  {
    id: 'unicorn',
    label: 'ユニコーン',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='unicorn_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE4FF'/>
      <stop offset='100%' stop-color='#DDBBEE'/>
    </linearGradient>
    <linearGradient id='unicorn_g2' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFD700'/>
      <stop offset='100%' stop-color='#FF8C00'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='58' rx='32' ry='26' fill='url(#unicorn_g1)' stroke='#AA88BB' stroke-width='3'/>
  <ellipse cx='50' cy='40' rx='22' ry='20' fill='url(#unicorn_g1)' stroke='#AA88BB' stroke-width='3'/>
  <polygon points='38,26 34,6 44,22' fill='url(#unicorn_g2)' stroke='#CC8800' stroke-width='2' stroke-linejoin='round'/>
  <ellipse cx='40' cy='37' rx='5' ry='6' fill='#333'/>
  <ellipse cx='58' cy='37' rx='5' ry='6' fill='#333'/>
  <circle cx='41' cy='35' r='2' fill='white'/>
  <circle cx='59' cy='35' r='2' fill='white'/>
  <ellipse cx='50' cy='50' rx='5' ry='3.5' fill='#FFAACC'/>
  <path d='M44 56 Q50 62 56 56' stroke='#AA88BB' stroke-width='2' fill='none' stroke-linecap='round'/>
  <path d='M36 28 Q32 22 28 18' stroke='#FF9EC4' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M38 30 Q36 22 34 16' stroke='#FFD700' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M40 28 Q40 20 40 14' stroke='#A855F7' stroke-width='3' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'dragon',
    label: 'ドラゴン',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='dragon_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#66CC44'/>
      <stop offset='100%' stop-color='#228800'/>
    </linearGradient>
  </defs>
  <path d='M24 72 Q10 60 12 44 Q14 28 30 22 Q50 14 68 26 Q84 38 82 56 Q80 72 62 78 Q52 82 42 78 Z'
        fill='url(#dragon_g1)' stroke='#114400' stroke-width='3' stroke-linejoin='round'/>
  <path d='M22 34 Q14 22 20 12 Q28 18 26 30 Z' fill='url(#dragon_g1)' stroke='#114400' stroke-width='2.5'/>
  <path d='M40 20 Q42 10 50 8 Q52 18 46 24 Z' fill='url(#dragon_g1)' stroke='#114400' stroke-width='2.5'/>
  <circle cx='38' cy='36' r='8' fill='#FFEE44' stroke='#114400' stroke-width='2'/>
  <circle cx='58' cy='32' r='8' fill='#FFEE44' stroke='#114400' stroke-width='2'/>
  <circle cx='38' cy='37' r='4' fill='#333'/>
  <circle cx='58' cy='33' r='4' fill='#333'/>
  <circle cx='39' cy='35' r='1.5' fill='white'/>
  <circle cx='59' cy='31' r='1.5' fill='white'/>
  <path d='M32 52 Q40 58 48 52' stroke='#114400' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M60 70 Q72 62 84 72' stroke='#114400' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M70 76 Q76 70 82 78' fill='#FF6633' stroke='#CC2200' stroke-width='2'/>
</svg>`
  },

  {
    id: 'dinosaur',
    label: 'きょうりゅう',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='dinosaur_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#88CC66'/>
      <stop offset='100%' stop-color='#449922'/>
    </linearGradient>
  </defs>
  <path d='M30 80 Q28 66 24 56 Q20 44 26 34 Q34 22 48 20 Q64 18 72 30 Q80 42 76 58 Q72 72 60 78 L60 88 L50 88 L50 78 Z'
        fill='url(#dinosaur_g1)' stroke='#226600' stroke-width='3' stroke-linejoin='round'/>
  <path d='M30 36 Q24 30 22 22 Q28 22 32 28 Z' fill='url(#dinosaur_g1)' stroke='#226600' stroke-width='2'/>
  <path d='M42 22 Q44 14 50 12 Q52 20 48 26 Z' fill='url(#dinosaur_g1)' stroke='#226600' stroke-width='2'/>
  <circle cx='44' cy='30' r='7' fill='#FFEE44' stroke='#226600' stroke-width='2'/>
  <circle cx='44' cy='31' r='4' fill='#333'/>
  <circle cx='45' cy='29' r='1.5' fill='white'/>
  <path d='M34 42 Q44 50 54 44' stroke='#226600' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M20 60 Q12 56 10 64' stroke='#226600' stroke-width='4' fill='none' stroke-linecap='round'/>
  <path d='M20 70 Q12 68 12 76' stroke='#226600' stroke-width='4' fill='none' stroke-linecap='round'/>
</svg>`
  },

  // --- 北極系 ---
  {
    id: 'polar_bear',
    label: 'シロクマ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <circle cx='28' cy='28' r='14' fill='#EEEEFF' stroke='#AABBCC' stroke-width='3'/>
  <circle cx='72' cy='28' r='14' fill='#EEEEFF' stroke='#AABBCC' stroke-width='3'/>
  <circle cx='50' cy='58' r='36' fill='#EEEEFF' stroke='#AABBCC' stroke-width='3'/>
  <ellipse cx='50' cy='65' rx='16' ry='12' fill='#DDDDEE'/>
  <circle cx='40' cy='48' r='7' fill='#1A3A5C'/>
  <circle cx='60' cy='48' r='7' fill='#1A3A5C'/>
  <circle cx='41' cy='46' r='2.5' fill='white'/>
  <circle cx='61' cy='46' r='2.5' fill='white'/>
  <ellipse cx='50' cy='62' rx='5' ry='3.5' fill='#556677'/>
  <path d='M44 68 Q50 74 56 68' stroke='#AABBCC' stroke-width='2.5' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'seal',
    label: 'アザラシ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='seal_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#AABBCC'/>
      <stop offset='100%' stop-color='#7788AA'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='62' rx='36' ry='28' fill='url(#seal_g1)' stroke='#445566' stroke-width='3'/>
  <ellipse cx='50' cy='44' rx='22' ry='20' fill='url(#seal_g1)' stroke='#445566' stroke-width='3'/>
  <ellipse cx='50' cy='60' rx='18' ry='14' fill='#CCDDE'/>
  <circle cx='40' cy='40' r='7' fill='#222'/>
  <circle cx='60' cy='40' r='7' fill='#222'/>
  <circle cx='41' cy='38' r='2.5' fill='white'/>
  <circle cx='61' cy='38' r='2.5' fill='white'/>
  <ellipse cx='50' cy='52' rx='5' ry='3' fill='#667788'/>
  <path d='M42 56 Q50 62 58 56' stroke='#445566' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M28 56 L14 52' stroke='#445566' stroke-width='2' stroke-linecap='round'/>
  <path d='M28 62 L14 62' stroke='#445566' stroke-width='2' stroke-linecap='round'/>
  <path d='M72 56 L86 52' stroke='#445566' stroke-width='2' stroke-linecap='round'/>
  <path d='M72 62 L86 62' stroke='#445566' stroke-width='2' stroke-linecap='round'/>
  <path d='M34 82 Q50 90 66 82' stroke='#445566' stroke-width='3' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'reindeer',
    label: 'トナカイ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='reindeer_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#C8844A'/>
      <stop offset='100%' stop-color='#8B5E2A'/>
    </linearGradient>
  </defs>
  <path d='M34 20 Q28 12 22 8 Q20 14 24 18 Q22 14 18 12 Q18 18 22 22 L30 28' stroke='#8B5E2A' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M66 20 Q72 12 78 8 Q80 14 76 18 Q78 14 82 12 Q82 18 78 22 L70 28' stroke='#8B5E2A' stroke-width='3' fill='none' stroke-linecap='round'/>
  <ellipse cx='50' cy='42' rx='22' ry='20' fill='url(#reindeer_g1)' stroke='#5C3D1E' stroke-width='3'/>
  <ellipse cx='50' cy='64' rx='28' ry='24' fill='url(#reindeer_g1)' stroke='#5C3D1E' stroke-width='3'/>
  <ellipse cx='50' cy='58' rx='16' ry='12' fill='#E8B07A'/>
  <circle cx='40' cy='38' r='6' fill='#222'/>
  <circle cx='60' cy='38' r='6' fill='#222'/>
  <circle cx='41' cy='36' r='2' fill='white'/>
  <circle cx='61' cy='36' r='2' fill='white'/>
  <circle cx='50' cy='50' r='7' fill='#FF4444' stroke='#CC0000' stroke-width='2'/>
  <path d='M42 62 Q50 68 58 62' stroke='#5C3D1E' stroke-width='2.5' fill='none' stroke-linecap='round'/>
</svg>`
  },

  // --- その他 ---
  {
    id: 'capybara',
    label: 'カピバラ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='capybara_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#C8A070'/>
      <stop offset='100%' stop-color='#8B6040'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='62' rx='38' ry='26' fill='url(#capybara_g1)' stroke='#5C3D20' stroke-width='3'/>
  <ellipse cx='50' cy='44' rx='24' ry='18' fill='url(#capybara_g1)' stroke='#5C3D20' stroke-width='3'/>
  <circle cx='18' cy='34' r='8' fill='url(#capybara_g1)' stroke='#5C3D20' stroke-width='2'/>
  <circle cx='82' cy='34' r='8' fill='url(#capybara_g1)' stroke='#5C3D20' stroke-width='2'/>
  <ellipse cx='40' cy='40' rx='6' ry='7' fill='#222'/>
  <ellipse cx='60' cy='40' rx='6' ry='7' fill='#222'/>
  <circle cx='41' cy='38' r='2' fill='white'/>
  <circle cx='61' cy='38' r='2' fill='white'/>
  <ellipse cx='50' cy='54' rx='14' ry='6' fill='#DDB888'/>
  <path d='M40 56 Q50 62 60 56' stroke='#5C3D20' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M28 58 L14 56' stroke='#5C3D20' stroke-width='2' stroke-linecap='round'/>
  <path d='M72 58 L86 56' stroke='#5C3D20' stroke-width='2' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'otter',
    label: 'カワウソ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='otter_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#8B6040'/>
      <stop offset='100%' stop-color='#5C3D20'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='60' rx='32' ry='28' fill='url(#otter_g1)' stroke='#3D2010' stroke-width='3'/>
  <ellipse cx='50' cy='44' rx='22' ry='20' fill='url(#otter_g1)' stroke='#3D2010' stroke-width='3'/>
  <ellipse cx='50' cy='56' rx='18' ry='12' fill='#C8A070'/>
  <circle cx='26' cy='32' r='10' fill='url(#otter_g1)' stroke='#3D2010' stroke-width='2'/>
  <circle cx='74' cy='32' r='10' fill='url(#otter_g1)' stroke='#3D2010' stroke-width='2'/>
  <circle cx='40' cy='40' r='7' fill='#222'/>
  <circle cx='60' cy='40' r='7' fill='#222'/>
  <circle cx='41' cy='38' r='2.5' fill='white'/>
  <circle cx='61' cy='38' r='2.5' fill='white'/>
  <ellipse cx='50' cy='52' rx='5' ry='3' fill='#5C3D20'/>
  <path d='M42 58 Q50 64 58 58' stroke='#3D2010' stroke-width='2.5' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'red_panda',
    label: 'レッサーパンダ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='red_panda_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#CC5522'/>
      <stop offset='100%' stop-color='#882200'/>
    </linearGradient>
  </defs>
  <circle cx='28' cy='30' r='14' fill='url(#red_panda_g1)' stroke='#551100' stroke-width='3'/>
  <circle cx='72' cy='30' r='14' fill='url(#red_panda_g1)' stroke='#551100' stroke-width='3'/>
  <circle cx='28' cy='30' r='8' fill='#FFCCAA'/>
  <circle cx='72' cy='30' r='8' fill='#FFCCAA'/>
  <circle cx='50' cy='56' r='36' fill='url(#red_panda_g1)' stroke='#551100' stroke-width='3'/>
  <ellipse cx='50' cy='64' rx='16' ry='12' fill='#FFCCAA'/>
  <ellipse cx='40' cy='48' rx='7' ry='8' fill='#222'/>
  <ellipse cx='60' cy='48' rx='7' ry='8' fill='#222'/>
  <circle cx='41' cy='46' r='2.5' fill='white'/>
  <circle cx='61' cy='46' r='2.5' fill='white'/>
  <ellipse cx='50' cy='60' rx='5' ry='3.5' fill='#551100'/>
  <path d='M42 66 Q50 72 58 66' stroke='#551100' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M28 52 L16 48 M28 58 L16 58' stroke='#551100' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M72 52 L84 48 M72 58 L84 58' stroke='#551100' stroke-width='1.5' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'hedgehog',
    label: 'ハリネズミ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='hedgehog_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#886633'/>
      <stop offset='100%' stop-color='#554422'/>
    </linearGradient>
  </defs>
  <path d='M22 62 Q18 42 28 28 Q40 14 58 16 Q76 18 82 34 Q88 50 80 64 Z'
        fill='url(#hedgehog_g1)' stroke='#332211' stroke-width='3' stroke-linejoin='round'/>
  <path d='M26 28 L20 16 M36 20 L32 8 M48 16 L48 4 M60 18 L62 6 M72 26 L78 14 M80 38 L90 30'
        stroke='#332211' stroke-width='2.5' stroke-linecap='round'/>
  <ellipse cx='44' cy='64' rx='24' ry='18' fill='#FFCC99' stroke='#884422' stroke-width='2.5'/>
  <ellipse cx='34' cy='62' rx='8' ry='9' fill='#222'/>
  <circle cx='35' cy='60' r='3' fill='white'/>
  <ellipse cx='50' cy='70' rx='7' ry='5' fill='#CC8866'/>
  <ellipse cx='50' cy='69' rx='4' ry='3' fill='#AA5544'/>
  <path d='M40 74 Q50 80 60 74' stroke='#884422' stroke-width='2' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'alpaca',
    label: 'アルパカ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='alpaca_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFFAEE'/>
      <stop offset='100%' stop-color='#EEE8CC'/>
    </linearGradient>
  </defs>
  <rect x='34' y='44' width='16' height='36' rx='8' fill='url(#alpaca_g1)' stroke='#AAAAAA' stroke-width='3'/>
  <ellipse cx='50' cy='58' rx='32' ry='26' fill='url(#alpaca_g1)' stroke='#AAAAAA' stroke-width='3'/>
  <ellipse cx='42' cy='34' rx='16' ry='18' fill='url(#alpaca_g1)' stroke='#AAAAAA' stroke-width='3'/>
  <path d='M38 22 Q38 10 42 8 Q44 14 44 22' fill='url(#alpaca_g1)' stroke='#AAAAAA' stroke-width='2' stroke-linejoin='round'/>
  <path d='M44 22 Q46 12 48 10 Q50 16 48 22' fill='url(#alpaca_g1)' stroke='#AAAAAA' stroke-width='2' stroke-linejoin='round'/>
  <circle cx='38' cy='32' r='5' fill='#333'/>
  <circle cx='50' cy='32' r='5' fill='#333'/>
  <circle cx='39' cy='30' r='2' fill='white'/>
  <circle cx='51' cy='30' r='2' fill='white'/>
  <ellipse cx='44' cy='44' rx='6' ry='4' fill='#DDCCBB'/>
  <path d='M38 48 Q44 54 50 48' stroke='#AAAAAA' stroke-width='2' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'raccoon',
    label: 'アライグマ',
    category: 'animal',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='raccoon_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#AAAAAA'/>
      <stop offset='100%' stop-color='#666666'/>
    </linearGradient>
  </defs>
  <circle cx='28' cy='28' r='14' fill='url(#raccoon_g1)' stroke='#444444' stroke-width='3'/>
  <circle cx='72' cy='28' r='14' fill='url(#raccoon_g1)' stroke='#444444' stroke-width='3'/>
  <circle cx='50' cy='56' r='36' fill='url(#raccoon_g1)' stroke='#444444' stroke-width='3'/>
  <ellipse cx='50' cy='64' rx='16' ry='12' fill='#DDDDDD'/>
  <ellipse cx='38' cy='46' rx='10' ry='10' fill='#333'/>
  <ellipse cx='62' cy='46' rx='10' ry='10' fill='#333'/>
  <circle cx='38' cy='46' r='6' fill='#555'/>
  <circle cx='62' cy='46' r='6' fill='#555'/>
  <circle cx='39' cy='44' r='2' fill='white'/>
  <circle cx='63' cy='44' r='2' fill='white'/>
  <ellipse cx='50' cy='60' rx='5' ry='3.5' fill='#444'/>
  <path d='M42 66 Q50 72 58 66' stroke='#444' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M28 52 L16 50 M28 56 L16 56' stroke='#444' stroke-width='1.5' stroke-linecap='round'/>
  <path d='M72 52 L84 50 M72 56 L84 56' stroke='#444' stroke-width='1.5' stroke-linecap='round'/>
</svg>`
  },


  // ===== 食べ物カテゴリ 追加47種 =====

  // --- スイーツ ---
  {
    id: 'donut',
    label: 'ドーナツ',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='donut_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#F4A261'/>
      <stop offset='100%' stop-color='#C96A1A'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='50' r='40' fill='url(#donut_g1)' stroke='#8B4513' stroke-width='3'/>
  <circle cx='50' cy='50' r='16' fill='white' stroke='#8B4513' stroke-width='2'/>
  <path d='M26 30 Q50 14 74 30' stroke='#FF6B9D' stroke-width='8' fill='none' stroke-linecap='round' opacity='0.9'/>
  <path d='M22 48 Q20 60 28 70' stroke='#FF6B9D' stroke-width='8' fill='none' stroke-linecap='round' opacity='0.9'/>
  <circle cx='40' cy='22' r='4' fill='#FFD700'/>
  <circle cx='60' cy='20' r='3' fill='#FF9EC4'/>
  <circle cx='72' cy='30' r='3' fill='#66CCFF'/>
  <circle cx='30' cy='64' r='3' fill='#FFD700'/>
</svg>`
  },

  {
    id: 'macaron',
    label: 'マカロン',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='macaron_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFB8CC'/>
      <stop offset='100%' stop-color='#FF88AA'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='32' rx='32' ry='20' fill='url(#macaron_g1)' stroke='#CC4488' stroke-width='3'/>
  <ellipse cx='50' cy='68' rx='32' ry='20' fill='url(#macaron_g1)' stroke='#CC4488' stroke-width='3'/>
  <rect x='18' y='44' width='64' height='12' fill='#FFF0F4' stroke='#CC4488' stroke-width='2'/>
  <ellipse cx='38' cy='27' rx='10' ry='6' fill='white' opacity='0.3'/>
  <ellipse cx='38' cy='64' rx='10' ry='6' fill='white' opacity='0.3'/>
</svg>`
  },

  {
    id: 'pudding',
    label: 'プリン',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='pudding_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <path d='M26 52 Q26 86 50 88 Q74 86 74 52 Q70 44 50 44 Q30 44 26 52 Z'
        fill='url(#pudding_g1)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
  <path d='M30 52 Q50 48 70 52' stroke='#FF8C00' stroke-width='4' fill='none' stroke-linecap='round'/>
  <path d='M26 52 Q30 60 30 52' stroke='#CC8800' stroke-width='2' fill='none'/>
  <ellipse cx='50' cy='34' rx='22' ry='14' fill='#CC4400' stroke='#882200' stroke-width='3'/>
  <ellipse cx='50' cy='34' rx='18' ry='10' fill='#EE6622'/>
  <ellipse cx='42' cy='30' rx='6' ry='4' fill='#FF9944' opacity='0.5'/>
</svg>`
  },

  {
    id: 'soft_cream',
    label: 'ソフトクリーム',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='soft_cream_g1' x1='0%' y1='0%' x2='0%' y2='100%'>
      <stop offset='0%' stop-color='#FFF8EE'/>
      <stop offset='100%' stop-color='#FFDDBB'/>
    </linearGradient>
  </defs>
  <polygon points='38,58 62,58 50,94' fill='#F4A261' stroke='#C96A1A' stroke-width='3' stroke-linejoin='round'/>
  <path d='M36 60 Q36 48 50 42 Q64 48 64 60' fill='url(#soft_cream_g1)' stroke='#CCBBAA' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M36 52 Q50 40 64 52 Q64 40 50 32 Q36 40 36 52 Z' fill='url(#soft_cream_g1)' stroke='#CCBBAA' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M40 44 Q50 34 60 44 Q60 34 50 24 Q40 34 40 44 Z' fill='url(#soft_cream_g1)' stroke='#CCBBAA' stroke-width='2.5' stroke-linejoin='round'/>
  <circle cx='50' cy='20' r='8' fill='url(#soft_cream_g1)' stroke='#CCBBAA' stroke-width='2.5'/>
  <path d='M38 66 L62 66' stroke='#CC8844' stroke-width='2.5' fill='none' stroke-linecap='round' opacity='0.5'/>
  <path d='M40 72 L60 72' stroke='#CC8844' stroke-width='2' fill='none' stroke-linecap='round' opacity='0.5'/>
</svg>`
  },

  {
    id: 'taiyaki',
    label: 'たいやき',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='taiyaki_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#D4885A'/>
      <stop offset='100%' stop-color='#8B4513'/>
    </linearGradient>
  </defs>
  <path d='M20 50 Q16 28 30 18 Q44 10 58 18 Q72 26 76 42 Q80 58 70 72 Q60 84 46 82 Q32 80 24 70 Q18 62 20 50 Z'
        fill='url(#taiyaki_g1)' stroke='#5C2D0E' stroke-width='3' stroke-linejoin='round'/>
  <path d='M62 36 Q76 28 84 18 Q78 32 74 42' fill='url(#taiyaki_g1)' stroke='#5C2D0E' stroke-width='2'/>
  <circle cx='36' cy='38' r='4' fill='#5C2D0E'/>
  <circle cx='37' cy='37' r='1.5' fill='white'/>
  <path d='M28 50 Q48 58 68 50' stroke='#5C2D0E' stroke-width='2' fill='none' stroke-linecap='round'/>
  <ellipse cx='50' cy='60' rx='14' ry='8' fill='#CC3322' opacity='0.6'/>
</svg>`
  },

  {
    id: 'mochi',
    label: 'おもち',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='mochi_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFF8EE'/>
      <stop offset='100%' stop-color='#FFEEDD'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='58' rx='38' ry='30' fill='url(#mochi_g1)' stroke='#DDBBAA' stroke-width='3'/>
  <ellipse cx='50' cy='52' rx='30' ry='22' fill='#FFF0E8' stroke='#DDBBAA' stroke-width='2'/>
  <ellipse cx='50' cy='46' rx='18' ry='12' fill='#FFCCDD'/>
  <ellipse cx='44' cy='42' rx='6' ry='4' fill='white' opacity='0.5'/>
</svg>`
  },

  {
    id: 'chocolate',
    label: 'チョコ',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='chocolate_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#8B4513'/>
      <stop offset='100%' stop-color='#4A1A00'/>
    </linearGradient>
  </defs>
  <rect x='12' y='20' width='76' height='60' rx='6' fill='url(#chocolate_g1)' stroke='#2A0A00' stroke-width='3'/>
  <line x1='12' y1='40' x2='88' y2='40' stroke='#5C2D0E' stroke-width='3'/>
  <line x1='12' y1='60' x2='88' y2='60' stroke='#5C2D0E' stroke-width='3'/>
  <line x1='36' y1='20' x2='36' y2='80' stroke='#5C2D0E' stroke-width='3'/>
  <line x1='60' y1='20' x2='60' y2='80' stroke='#5C2D0E' stroke-width='3'/>
  <ellipse cx='24' cy='30' rx='6' ry='4' fill='#AA5522' opacity='0.4'/>
  <rect x='14' y='22' width='20' height='16' rx='3' fill='#5C2D0E' opacity='0.3'/>
  <text x='50' y='58' font-family='Arial,sans-serif' font-size='10' fill='#C87A40' text-anchor='middle' opacity='0.8'>CHOCO</text>
</svg>`
  },

  {
    id: 'candy',
    label: 'アメ',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='candy_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF6B9D'/>
      <stop offset='100%' stop-color='#CC0055'/>
    </linearGradient>
  </defs>
  <rect x='46' y='52' width='8' height='42' rx='4' fill='#FFDDAA' stroke='#CC8844' stroke-width='2'/>
  <circle cx='50' cy='44' r='34' fill='url(#candy_g1)' stroke='#880033' stroke-width='3'/>
  <path d='M20 32 Q50 16 80 32' stroke='white' stroke-width='6' fill='none' stroke-linecap='round' opacity='0.5'/>
  <path d='M16 46 Q20 58 28 68' stroke='white' stroke-width='6' fill='none' stroke-linecap='round' opacity='0.5'/>
  <ellipse cx='36' cy='26' rx='10' ry='7' fill='white' opacity='0.3' transform='rotate(-30 36 26)'/>
</svg>`
  },

  // --- フルーツ ---
  {
    id: 'strawberry',
    label: 'いちご',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='strawberry_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF6666'/>
      <stop offset='100%' stop-color='#CC0000'/>
    </linearGradient>
  </defs>
  <path d='M50 88 C50 88 14 60 14 38 C14 22 28 16 40 22 C44 24 48 28 50 34 C52 28 56 24 60 22 C72 16 86 22 86 38 C86 60 50 88 50 88 Z'
        fill='url(#strawberry_g1)' stroke='#880000' stroke-width='3' stroke-linejoin='round'/>
  <path d='M36 20 Q40 10 46 8' stroke='#44AA22' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <path d='M50 18 Q50 8 52 6' stroke='#44AA22' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <path d='M64 20 Q60 10 54 8' stroke='#44AA22' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <circle cx='38' cy='44' r='3' fill='#FFE566'/>
  <circle cx='52' cy='38' r='3' fill='#FFE566'/>
  <circle cx='62' cy='50' r='3' fill='#FFE566'/>
  <circle cx='44' cy='58' r='3' fill='#FFE566'/>
  <circle cx='58' cy='66' r='3' fill='#FFE566'/>
  <ellipse cx='38' cy='34' rx='8' ry='6' fill='white' opacity='0.3'/>
</svg>`
  },

  {
    id: 'watermelon',
    label: 'スイカ',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <path d='M12 62 Q12 20 50 16 Q88 20 88 62 Z'
        fill='#44BB44' stroke='#226622' stroke-width='3' stroke-linejoin='round'/>
  <path d='M14 64 Q14 24 50 20 Q86 24 86 64 Z' fill='#AADDAA'/>
  <path d='M16 66 Q16 28 50 24 Q84 28 84 66 Z' fill='#FF4444'/>
  <ellipse cx='34' cy='56' rx='5' ry='6' fill='#111' opacity='0.7'/>
  <ellipse cx='50' cy='54' rx='5' ry='6' fill='#111' opacity='0.7'/>
  <ellipse cx='66' cy='56' rx='5' ry='6' fill='#111' opacity='0.7'/>
  <ellipse cx='42' cy='66' rx='5' ry='6' fill='#111' opacity='0.7'/>
  <ellipse cx='58' cy='66' rx='5' ry='6' fill='#111' opacity='0.7'/>
  <path d='M12 64 Q50 80 88 64' stroke='#226622' stroke-width='3' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'cherry',
    label: 'さくらんぼ',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='cherry_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF4466'/>
      <stop offset='100%' stop-color='#CC0033'/>
    </linearGradient>
  </defs>
  <path d='M34 52 Q40 24 58 18' stroke='#44AA22' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M66 52 Q60 24 58 18' stroke='#44AA22' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M58 18 Q52 12 58 8 Q64 12 58 18' fill='#44AA22' stroke='#226600' stroke-width='2'/>
  <circle cx='34' cy='66' r='16' fill='url(#cherry_g1)' stroke='#880022' stroke-width='3'/>
  <circle cx='66' cy='66' r='16' fill='url(#cherry_g1)' stroke='#880022' stroke-width='3'/>
  <ellipse cx='28' cy='60' rx='5' ry='4' fill='white' opacity='0.4'/>
  <ellipse cx='60' cy='60' rx='5' ry='4' fill='white' opacity='0.4'/>
</svg>`
  },

  {
    id: 'banana',
    label: 'バナナ',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='banana_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFCC00'/>
    </linearGradient>
  </defs>
  <path d='M22 72 Q20 44 36 26 Q50 12 70 16 Q82 18 84 26 Q72 22 58 28 Q40 36 34 56 Q30 70 32 80 Q28 80 22 72 Z'
        fill='url(#banana_g1)' stroke='#CC9900' stroke-width='3' stroke-linejoin='round'/>
  <path d='M32 80 Q36 86 44 86 Q60 84 68 70 Q76 56 70 38' stroke='#CC9900' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M70 38 Q76 30 84 26' stroke='#CC9900' stroke-width='3' fill='none' stroke-linecap='round'/>
  <ellipse cx='40' cy='38' rx='8' ry='5' fill='#FFEE99' opacity='0.5' transform='rotate(-40 40 38)'/>
</svg>`
  },

  {
    id: 'lemon',
    label: 'レモン',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='lemon_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFCC00'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='52' rx='36' ry='30' fill='url(#lemon_g1)' stroke='#CC9900' stroke-width='3'/>
  <path d='M14 52 Q14 38 20 30' stroke='#FFEE99' stroke-width='4' fill='none' stroke-linecap='round' opacity='0.5'/>
  <path d='M86 52 Q86 66 80 74' stroke='#FFEE99' stroke-width='4' fill='none' stroke-linecap='round' opacity='0.5'/>
  <path d='M50 22 Q46 14 50 8 Q54 14 50 22 Z' fill='#AACC44' stroke='#448800' stroke-width='2'/>
  <ellipse cx='38' cy='42' rx='10' ry='7' fill='white' opacity='0.3' transform='rotate(-20 38 42)'/>
</svg>`
  },

  {
    id: 'grape',
    label: 'ぶどう',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='grape_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#AA66DD'/>
      <stop offset='100%' stop-color='#7722AA'/>
    </linearGradient>
  </defs>
  <path d='M50 10 Q46 4 50 2 Q54 4 50 10 Z' fill='#448822' stroke='#224400' stroke-width='2'/>
  <path d='M50 10 Q36 8 32 18 Q44 18 50 24 Q56 18 68 18 Q64 8 50 10 Z' fill='#88CC44' stroke='#448822' stroke-width='2'/>
  <circle cx='34' cy='36' r='13' fill='url(#grape_g1)' stroke='#550088' stroke-width='2.5'/>
  <circle cx='66' cy='36' r='13' fill='url(#grape_g1)' stroke='#550088' stroke-width='2.5'/>
  <circle cx='50' cy='52' r='13' fill='url(#grape_g1)' stroke='#550088' stroke-width='2.5'/>
  <circle cx='20' cy='52' r='13' fill='url(#grape_g1)' stroke='#550088' stroke-width='2.5'/>
  <circle cx='80' cy='52' r='13' fill='url(#grape_g1)' stroke='#550088' stroke-width='2.5'/>
  <circle cx='34' cy='70' r='13' fill='url(#grape_g1)' stroke='#550088' stroke-width='2.5'/>
  <circle cx='66' cy='70' r='13' fill='url(#grape_g1)' stroke='#550088' stroke-width='2.5'/>
  <circle cx='50' cy='86' r='11' fill='url(#grape_g1)' stroke='#550088' stroke-width='2.5'/>
  <circle cx='36' cy='30' r='4' fill='#CC99EE' opacity='0.5'/>
</svg>`
  },

  {
    id: 'peach',
    label: 'もも',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='peach_g1' x1='20%' y1='10%' x2='80%' y2='90%'>
      <stop offset='0%' stop-color='#FFD0B0'/>
      <stop offset='50%' stop-color='#FFAA88'/>
      <stop offset='100%' stop-color='#FF8866'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='58' r='36' fill='url(#peach_g1)' stroke='#CC6644' stroke-width='3'/>
  <path d='M50 22 Q50 10 52 8' stroke='#44AA22' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M52 12 Q60 8 62 14' fill='#44AA22' stroke='#226600' stroke-width='2'/>
  <path d='M50 22 Q50 38 50 58' stroke='#CC6644' stroke-width='2.5' fill='none' opacity='0.5'/>
  <ellipse cx='38' cy='44' rx='10' ry='8' fill='white' opacity='0.3' transform='rotate(-20 38 44)'/>
</svg>`
  },

  // --- 料理 ---
  {
    id: 'ramen',
    label: 'ラーメン',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='ramen_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFEECC'/>
      <stop offset='100%' stop-color='#FFDDAA'/>
    </linearGradient>
  </defs>
  <path d='M16 52 L20 84 Q20 90 30 90 L70 90 Q80 90 80 84 L84 52 Z'
        fill='#FFFFFF' stroke='#AAAAAA' stroke-width='3' stroke-linejoin='round'/>
  <ellipse cx='50' cy='52' rx='34' ry='14' fill='url(#ramen_g1)' stroke='#AA8844' stroke-width='3'/>
  <path d='M30 50 Q38 44 46 50 Q54 56 62 50 Q70 44 76 50' stroke='#FFCC66' stroke-width='3' fill='none' stroke-linecap='round'/>
  <circle cx='36' cy='64' r='10' fill='#FF9988' stroke='#CC4433' stroke-width='2'/>
  <path d='M26 64 Q36 72 46 64' stroke='#CC4433' stroke-width='2' fill='none' stroke-linecap='round'/>
  <ellipse cx='62' cy='68' rx='10' ry='6' fill='#FFE566' stroke='#CC9900' stroke-width='2'/>
  <circle cx='72' cy='60' r='6' fill='#66BB44' stroke='#338822' stroke-width='2'/>
  <path d='M22 42 Q24 32 22 24' stroke='#AAAAAA' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M30 38 Q32 26 30 18' stroke='#AAAAAA' stroke-width='2.5' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'sushi',
    label: 'すし',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <ellipse cx='50' cy='68' rx='34' ry='18' fill='white' stroke='#AAAAAA' stroke-width='3'/>
  <ellipse cx='50' cy='62' rx='28' ry='14' fill='#FFFAF0'/>
  <ellipse cx='50' cy='52' rx='32' ry='16' fill='#FF8888' stroke='#CC4444' stroke-width='2.5'/>
  <ellipse cx='50' cy='48' rx='26' ry='12' fill='#FF6666'/>
  <ellipse cx='42' cy='44' rx='8' ry='5' fill='#FF9999' opacity='0.5'/>
  <path d='M28 56 Q50 64 72 56' stroke='#AAAAAA' stroke-width='2' fill='none' stroke-linecap='round'/>
  <path d='M50 36 Q44 30 42 24' stroke='#44AA22' stroke-width='3' fill='none' stroke-linecap='round'/>
  <path d='M50 36 Q56 30 58 24' stroke='#44AA22' stroke-width='3' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'rice_ball',
    label: 'おにぎり',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <path d='M50 12 Q26 14 16 38 L16 80 Q16 86 22 86 L78 86 Q84 86 84 80 L84 38 Q74 14 50 12 Z'
        fill='white' stroke='#AAAAAA' stroke-width='3' stroke-linejoin='round'/>
  <path d='M22 80 L78 80' stroke='#222' stroke-width='8' stroke-linecap='round'/>
  <path d='M16 68 L24 68' stroke='#222' stroke-width='8' stroke-linecap='round'/>
  <path d='M76 68 L84 68' stroke='#222' stroke-width='8' stroke-linecap='round'/>
  <circle cx='50' cy='52' r='12' fill='#FF6B9D' stroke='#CC2266' stroke-width='2'/>
  <ellipse cx='44' cy='48' rx='4' ry='3' fill='#FF99BB' opacity='0.5'/>
  <path d='M36 18 Q32 12 36 8 Q40 12 36 18 Z' fill='#44AA22'/>
  <path d='M64 18 Q68 12 64 8 Q60 12 64 18 Z' fill='#44AA22'/>
</svg>`
  },

  {
    id: 'hamburger',
    label: 'ハンバーガー',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <path d='M16 42 Q16 22 50 20 Q84 22 84 42 Z' fill='#F4A261' stroke='#C96A1A' stroke-width='3'/>
  <ellipse cx='50' cy='42' rx='34' ry='10' fill='#F4D03F' stroke='#CC9900' stroke-width='2'/>
  <rect x='14' y='52' width='72' height='12' rx='2' fill='#CC4422' stroke='#881100' stroke-width='2'/>
  <rect x='14' y='64' width='72' height='10' rx='2' fill='#FFD700' stroke='#CC8800' stroke-width='2'/>
  <rect x='14' y='62' width='72' height='6' fill='#44BB44'/>
  <path d='M14 74 Q50 84 86 74 Q86 84 50 88 Q14 84 14 74 Z' fill='#F4A261' stroke='#C96A1A' stroke-width='3'/>
  <circle cx='32' cy='36' r='4' fill='#FFE566' opacity='0.6'/>
  <circle cx='50' cy='32' r='4' fill='#FFE566' opacity='0.6'/>
  <circle cx='68' cy='36' r='4' fill='#FFE566' opacity='0.6'/>
</svg>`
  },

  {
    id: 'curry',
    label: 'カレー',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='curry_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFFAF0'/>
      <stop offset='100%' stop-color='#FFF0E0'/>
    </linearGradient>
  </defs>
  <path d='M12 50 L14 84 Q14 90 22 90 L78 90 Q86 90 86 84 L88 50 Z'
        fill='url(#curry_g1)' stroke='#CCBBAA' stroke-width='3' stroke-linejoin='round'/>
  <ellipse cx='50' cy='50' rx='38' ry='12' fill='#FFCC44' stroke='#CC8800' stroke-width='3'/>
  <path d='M14 60 Q50 72 86 60' stroke='#FFAA22' stroke-width='3' fill='none'/>
  <path d='M20 70 Q50 80 80 70' stroke='#FFAA22' stroke-width='2.5' fill='none'/>
  <circle cx='36' cy='62' r='7' fill='#884422'/>
  <circle cx='56' cy='56' r='6' fill='#884422'/>
  <circle cx='68' cy='64' r='5' fill='#884422'/>
  <ellipse cx='28' cy='56' rx='8' ry='4' fill='#DDCC88' opacity='0.6'/>
</svg>`
  },

  {
    id: 'takoyaki',
    label: 'たこやき',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='takoyaki_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#D4885A'/>
      <stop offset='100%' stop-color='#8B4513'/>
    </linearGradient>
  </defs>
  <circle cx='28' cy='62' r='20' fill='url(#takoyaki_g1)' stroke='#5C2D0E' stroke-width='3'/>
  <circle cx='72' cy='62' r='20' fill='url(#takoyaki_g1)' stroke='#5C2D0E' stroke-width='3'/>
  <circle cx='50' cy='42' r='20' fill='url(#takoyaki_g1)' stroke='#5C2D0E' stroke-width='3'/>
  <path d='M14 62 Q28 72 42 62' stroke='#CC3322' stroke-width='3' fill='none' stroke-linecap='round' opacity='0.8'/>
  <path d='M58 62 Q72 72 86 62' stroke='#CC3322' stroke-width='3' fill='none' stroke-linecap='round' opacity='0.8'/>
  <path d='M36 42 Q50 52 64 42' stroke='#CC3322' stroke-width='3' fill='none' stroke-linecap='round' opacity='0.8'/>
  <path d='M16 54 Q28 50 40 56 M22 68 Q28 72 34 68' stroke='#8B4513' stroke-width='2' fill='none'/>
  <path d='M62 54 Q72 50 82 56 M66 68 Q72 72 78 68' stroke='#8B4513' stroke-width='2' fill='none'/>
</svg>`
  },

  {
    id: 'dango',
    label: 'だんご',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <rect x='46' y='28' width='8' height='58' rx='4' fill='#DDCCAA' stroke='#AA8844' stroke-width='2'/>
  <circle cx='50' cy='28' r='16' fill='#FF9EC4' stroke='#CC4488' stroke-width='3'/>
  <circle cx='50' cy='54' r='16' fill='white' stroke='#AAAAAA' stroke-width='3'/>
  <circle cx='50' cy='80' r='16' fill='#66BB66' stroke='#338833' stroke-width='3'/>
  <ellipse cx='44' cy='23' rx='5' ry='3' fill='white' opacity='0.4'/>
  <ellipse cx='44' cy='49' rx='5' ry='3' fill='white' opacity='0.4'/>
  <ellipse cx='44' cy='75' rx='5' ry='3' fill='white' opacity='0.4'/>
</svg>`
  },

  {
    id: 'tea',
    label: 'お茶',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='tea_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFFAF0'/>
      <stop offset='100%' stop-color='#FFF0D0'/>
    </linearGradient>
  </defs>
  <path d='M20 40 L26 85 Q26 90 32 90 L62 90 Q68 90 68 85 L74 40 Z'
        fill='url(#tea_g1)' stroke='#AAAAAA' stroke-width='3' stroke-linejoin='round'/>
  <path d='M68 52 Q82 52 82 62 Q82 72 68 72' stroke='#AAAAAA' stroke-width='3' fill='none' stroke-linecap='round'/>
  <ellipse cx='47' cy='40' rx='27' ry='8' fill='#88CC44' stroke='#448822' stroke-width='3'/>
  <ellipse cx='47' cy='40' rx='22' ry='5' fill='#66BB33'/>
  <path d='M36 26 Q38 18 36 12' stroke='#AAAAAA' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <path d='M47 22 Q50 12 47 6' stroke='#AAAAAA' stroke-width='2.5' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'juice',
    label: 'ジュース',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='juice_g1' x1='0%' y1='0%' x2='0%' y2='100%'>
      <stop offset='0%' stop-color='#FFEE88'/>
      <stop offset='100%' stop-color='#FF8833'/>
    </linearGradient>
  </defs>
  <path d='M28 36 L32 88 Q32 94 40 94 L60 94 Q68 94 68 88 L72 36 Z'
        fill='url(#juice_g1)' stroke='#CC6600' stroke-width='3' stroke-linejoin='round'/>
  <rect x='24' y='28' width='52' height='12' rx='4' fill='#FFFFFF' stroke='#CCCCCC' stroke-width='2'/>
  <rect x='32' y='22' width='36' height='10' rx='4' fill='#CCEECC' stroke='#88AA88' stroke-width='2'/>
  <path d='M36 36 Q50 44 64 36' stroke='#CC6600' stroke-width='2' fill='none' opacity='0.4'/>
  <rect x='44' y='12' width='6' height='14' rx='3' fill='#FFFFFF' stroke='#CCCCCC' stroke-width='2'/>
  <ellipse cx='40' cy='56' rx='8' ry='5' fill='white' opacity='0.3'/>
</svg>`
  },

  {
    id: 'egg',
    label: 'たまご',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <ellipse cx='50' cy='54' rx='32' ry='38' fill='white' stroke='#DDDDCC' stroke-width='3'/>
  <ellipse cx='50' cy='62' rx='20' ry='18' fill='#FFD700' stroke='#CC9900' stroke-width='2'/>
  <ellipse cx='42' cy='40' rx='10' ry='7' fill='white' opacity='0.5'/>
</svg>`
  },

  {
    id: 'bread',
    label: 'パン',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='bread_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#F4C68A'/>
      <stop offset='100%' stop-color='#C97A2A'/>
    </linearGradient>
  </defs>
  <path d='M10 52 Q10 24 50 20 Q90 24 90 52 Q90 72 70 78 L30 78 Q10 72 10 52 Z'
        fill='url(#bread_g1)' stroke='#8B4513' stroke-width='3' stroke-linejoin='round'/>
  <path d='M16 52 Q16 34 50 30 Q84 34 84 52 Q84 66 66 72 L34 72 Q16 66 16 52 Z' fill='#F4A261' opacity='0.5'/>
  <path d='M28 52 Q50 46 72 52' stroke='#8B4513' stroke-width='2.5' fill='none' stroke-linecap='round' opacity='0.5'/>
  <ellipse cx='38' cy='38' rx='10' ry='7' fill='white' opacity='0.3'/>
</svg>`
  },

  {
    id: 'cheese',
    label: 'チーズ',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='cheese_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFBB00'/>
    </linearGradient>
  </defs>
  <polygon points='50,10 92,86 8,86' fill='url(#cheese_g1)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
  <circle cx='42' cy='60' r='8' fill='#FFDD00' stroke='#CC8800' stroke-width='2'/>
  <circle cx='62' cy='70' r='6' fill='#FFDD00' stroke='#CC8800' stroke-width='2'/>
  <circle cx='34' cy='76' r='5' fill='#FFDD00' stroke='#CC8800' stroke-width='2'/>
  <circle cx='56' cy='46' r='4' fill='#FFDD00' stroke='#CC8800' stroke-width='2'/>
  <ellipse cx='38' cy='32' rx='8' ry='5' fill='#FFEE99' opacity='0.4'/>
</svg>`
  },

  {
    id: 'mushroom',
    label: 'きのこ',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='mushroom_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF6633'/>
      <stop offset='100%' stop-color='#CC2200'/>
    </linearGradient>
  </defs>
  <rect x='38' y='58' width='24' height='32' rx='8' fill='#FFEECC' stroke='#CC8844' stroke-width='3'/>
  <path d='M10 54 Q10 16 50 16 Q90 16 90 54 Q80 66 50 66 Q20 66 10 54 Z'
        fill='url(#mushroom_g1)' stroke='#881100' stroke-width='3' stroke-linejoin='round'/>
  <circle cx='36' cy='46' r='8' fill='white' stroke='#881100' stroke-width='2'/>
  <circle cx='58' cy='38' r='7' fill='white' stroke='#881100' stroke-width='2'/>
  <circle cx='68' cy='52' r='6' fill='white' stroke='#881100' stroke-width='2'/>
  <ellipse cx='32' cy='30' rx='8' ry='6' fill='#FF9977' opacity='0.4'/>
</svg>`
  },

  {
    id: 'carrot',
    label: 'にんじん',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='carrot_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF9944'/>
      <stop offset='100%' stop-color='#FF5511'/>
    </linearGradient>
  </defs>
  <path d='M42 28 Q38 52 40 72 Q44 86 50 90 Q56 86 60 72 Q62 52 58 28 Z'
        fill='url(#carrot_g1)' stroke='#CC4400' stroke-width='3' stroke-linejoin='round'/>
  <path d='M38 30 Q50 40 62 30' stroke='#CC4400' stroke-width='2' fill='none' stroke-linecap='round' opacity='0.5'/>
  <path d='M38 44 Q50 52 62 44' stroke='#CC4400' stroke-width='2' fill='none' stroke-linecap='round' opacity='0.5'/>
  <path d='M40 58 Q50 64 60 58' stroke='#CC4400' stroke-width='2' fill='none' stroke-linecap='round' opacity='0.5'/>
  <path d='M40 24 Q38 14 34 10' stroke='#44BB22' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <path d='M50 22 Q50 12 52 8' stroke='#44BB22' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <path d='M60 24 Q62 14 66 10' stroke='#44BB22' stroke-width='3.5' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'tomato',
    label: 'トマト',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='tomato_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF5544'/>
      <stop offset='100%' stop-color='#CC1100'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='58' r='36' fill='url(#tomato_g1)' stroke='#880000' stroke-width='3'/>
  <path d='M40 24 Q38 14 34 10 Q40 12 44 18 Z' fill='#44BB22' stroke='#226600' stroke-width='2'/>
  <path d='M50 22 Q52 12 56 8 Q58 14 56 20 Z' fill='#44BB22' stroke='#226600' stroke-width='2'/>
  <path d='M62 26 Q66 16 72 14 Q68 20 66 28 Z' fill='#44BB22' stroke='#226600' stroke-width='2'/>
  <path d='M40 22 Q50 18 62 26' stroke='#44BB22' stroke-width='3' fill='none' stroke-linecap='round'/>
  <ellipse cx='38' cy='48' rx='10' ry='8' fill='white' opacity='0.3' transform='rotate(-20 38 48)'/>
  <path d='M28 58 Q50 66 72 58' stroke='#880000' stroke-width='2' fill='none' opacity='0.4' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'avocado',
    label: 'アボカド',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='avocado_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#66AA44'/>
      <stop offset='100%' stop-color='#224400'/>
    </linearGradient>
  </defs>
  <path d='M50 10 Q28 12 22 42 Q18 62 22 76 Q30 92 50 92 Q70 92 78 76 Q82 62 78 42 Q72 12 50 10 Z'
        fill='url(#avocado_g1)' stroke='#1A3300' stroke-width='3' stroke-linejoin='round'/>
  <ellipse cx='50' cy='62' rx='24' ry='26' fill='#CCEE99'/>
  <circle cx='50' cy='64' r='14' fill='#8B4513' stroke='#5C2D0E' stroke-width='2'/>
  <circle cx='50' cy='64' r='10' fill='#C8844A'/>
  <ellipse cx='45' cy='60' rx='4' ry='3' fill='#FFCC88' opacity='0.5'/>
</svg>`
  },

  {
    id: 'honey',
    label: 'はちみつ',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='honey_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFD700'/>
      <stop offset='100%' stop-color='#CC8800'/>
    </linearGradient>
  </defs>
  <path d='M28 32 L28 80 Q28 90 50 90 Q72 90 72 80 L72 32 Q72 22 50 22 Q28 22 28 32 Z'
        fill='url(#honey_g1)' stroke='#885500' stroke-width='3' stroke-linejoin='round'/>
  <rect x='36' y='16' width='28' height='10' rx='5' fill='#FFEEAA' stroke='#885500' stroke-width='2'/>
  <path d='M40 60 Q50 68 60 60' stroke='#885500' stroke-width='2.5' fill='none' stroke-linecap='round'/>
  <ellipse cx='42' cy='44' rx='8' ry='6' fill='#FFEE88' opacity='0.5'/>
  <text x='50' y='84' font-family='Arial,sans-serif' font-size='12' font-weight='bold' fill='#885500' text-anchor='middle' opacity='0.7'>H</text>
</svg>`
  },

  {
    id: 'corn',
    label: 'とうもろこし',
    category: 'food',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='corn_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <path d='M36 22 Q36 72 50 88 Q64 72 64 22 Q64 12 50 12 Q36 12 36 22 Z'
        fill='url(#corn_g1)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
  <path d='M38 26 Q50 32 62 26 M38 34 Q50 40 62 34 M38 42 Q50 48 62 42 M38 50 Q50 56 62 50 M38 58 Q50 64 62 58 M38 66 Q50 72 62 66'
        stroke='#CC8800' stroke-width='2' fill='none' stroke-linecap='round' opacity='0.6'/>
  <path d='M30 18 Q26 10 30 6 Q34 14 30 18 Z' fill='#44BB22' stroke='#226600' stroke-width='2'/>
  <path d='M40 14 Q38 6 42 4 Q44 12 40 14 Z' fill='#44BB22' stroke='#226600' stroke-width='2'/>
  <path d='M60 14 Q62 6 58 4 Q56 12 60 14 Z' fill='#44BB22' stroke='#226600' stroke-width='2'/>
  <path d='M70 18 Q74 10 70 6 Q66 14 70 18 Z' fill='#44BB22' stroke='#226600' stroke-width='2'/>
</svg>`
  },


  // ===== 自然カテゴリ 追加26種 =====

  {
    id: 'moon',
    label: 'つき',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='moon_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFBB00'/>
    </linearGradient>
  </defs>
  <path d='M60 14 Q90 22 90 50 Q90 78 60 86 Q78 74 78 50 Q78 26 60 14 Z'
        fill='url(#moon_g1)' stroke='#CC8800' stroke-width='3' stroke-linejoin='round'/>
  <circle cx='38' cy='36' r='5' fill='#CCAA00' opacity='0.4'/>
  <circle cx='52' cy='58' r='7' fill='#CCAA00' opacity='0.4'/>
  <circle cx='36' cy='62' r='4' fill='#CCAA00' opacity='0.4'/>
  <circle cx='88' cy='18' r='4' fill='#FFE566' opacity='0.7'/>
  <circle cx='78' cy='8' r='3' fill='#FFE566' opacity='0.5'/>
  <circle cx='92' cy='30' r='2' fill='#FFE566' opacity='0.5'/>
</svg>`
  },

  {
    id: 'cloud',
    label: 'くも',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <circle cx='30' cy='52' r='20' fill='white' stroke='#CCCCCC' stroke-width='3'/>
  <circle cx='52' cy='44' r='26' fill='white' stroke='#CCCCCC' stroke-width='3'/>
  <circle cx='74' cy='54' r='18' fill='white' stroke='#CCCCCC' stroke-width='3'/>
  <rect x='14' y='54' width='72' height='20' fill='white' stroke='none'/>
  <path d='M14 66 Q50 74 86 66' stroke='#CCCCCC' stroke-width='3' fill='none'/>
</svg>`
  },

  {
    id: 'rain',
    label: 'あめ',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <circle cx='30' cy='38' r='16' fill='#AABBCC' stroke='#8899AA' stroke-width='2'/>
  <circle cx='50' cy='32' r='20' fill='#AABBCC' stroke='#8899AA' stroke-width='2'/>
  <circle cx='70' cy='40' r='14' fill='#AABBCC' stroke='#8899AA' stroke-width='2'/>
  <rect x='18' y='40' width='62' height='14' fill='#AABBCC'/>
  <path d='M26 60 Q24 72 22 84' stroke='#4488CC' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <path d='M40 64 Q38 76 36 88' stroke='#4488CC' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <path d='M54 60 Q52 72 50 84' stroke='#4488CC' stroke-width='3.5' fill='none' stroke-linecap='round'/>
  <path d='M68 64 Q66 76 64 88' stroke='#4488CC' stroke-width='3.5' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'thunder',
    label: 'かみなり_n',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <circle cx='30' cy='36' r='18' fill='#888899' stroke='#555566' stroke-width='2'/>
  <circle cx='52' cy='28' r='22' fill='#888899' stroke='#555566' stroke-width='2'/>
  <circle cx='72' cy='38' r='16' fill='#888899' stroke='#555566' stroke-width='2'/>
  <rect x='16' y='38' width='64' height='14' fill='#888899'/>
  <polygon points='54,54 42,72 52,72 38,94 62,70 52,70'
           fill='#FFE566' stroke='#CC8800' stroke-width='2.5' stroke-linejoin='round'/>
</svg>`
  },

  {
    id: 'snow',
    label: 'ゆき',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <circle cx='30' cy='40' r='18' fill='#DDEEEE' stroke='#AABBCC' stroke-width='2'/>
  <circle cx='54' cy='32' r='22' fill='#DDEEEE' stroke='#AABBCC' stroke-width='2'/>
  <circle cx='74' cy='42' r='15' fill='#DDEEEE' stroke='#AABBCC' stroke-width='2'/>
  <rect x='16' y='42' width='66' height='12' fill='#DDEEEE'/>
  <circle cx='26' cy='66' r='6' fill='white' stroke='#99AACC' stroke-width='2'/>
  <circle cx='44' cy='72' r='5' fill='white' stroke='#99AACC' stroke-width='2'/>
  <circle cx='60' cy='64' r='7' fill='white' stroke='#99AACC' stroke-width='2'/>
  <circle cx='76' cy='70' r='5' fill='white' stroke='#99AACC' stroke-width='2'/>
  <circle cx='36' cy='80' r='4' fill='white' stroke='#99AACC' stroke-width='2'/>
  <circle cx='52' cy='84' r='6' fill='white' stroke='#99AACC' stroke-width='2'/>
  <circle cx='68' cy='82' r='4' fill='white' stroke='#99AACC' stroke-width='2'/>
</svg>`
  },

  {
    id: 'volcano',
    label: 'かざん',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <polygon points='50,20 80,88 20,88' fill='#887766' stroke='#554433' stroke-width='3' stroke-linejoin='round'/>
  <polygon points='50,20 66,56 34,56' fill='#665544'/>
  <path d='M40 20 Q50 8 60 20' fill='#CC2200' stroke='#880000' stroke-width='2' stroke-linejoin='round'/>
  <path d='M44 16 Q46 8 50 6 Q52 10 50 14 Q48 18 44 16 Z' fill='#FF6633' stroke='#CC2200' stroke-width='2'/>
  <path d='M54 16 Q58 8 62 10 Q60 16 56 18 Z' fill='#FFB300' stroke='#CC6600' stroke-width='2'/>
  <path d='M36 24 Q40 14 44 18 Q40 24 36 24 Z' fill='#FF9900' stroke='#CC5500' stroke-width='2'/>
  <path d='M28 84 L72 84' stroke='#FF6633' stroke-width='4' stroke-linecap='round' opacity='0.7'/>
</svg>`
  },

  {
    id: 'mountain',
    label: 'やま',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <polygon points='50,10 90,88 10,88' fill='#7788AA' stroke='#445566' stroke-width='3' stroke-linejoin='round'/>
  <polygon points='50,10 68,50 32,50' fill='white' opacity='0.7'/>
  <polygon points='72,30 92,88 52,88' fill='#6677AA' stroke='#445566' stroke-width='2' stroke-linejoin='round'/>
  <path d='M10 88 Q50 94 90 88' stroke='#445566' stroke-width='2' fill='none'/>
  <circle cx='22' cy='72' r='4' fill='#44BB44' opacity='0.7'/>
  <circle cx='78' cy='68' r='4' fill='#44BB44' opacity='0.7'/>
</svg>`
  },

  {
    id: 'wave_nature',
    label: 'なみ',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='wave_nature_g1' x1='0%' y1='0%' x2='0%' y2='100%'>
      <stop offset='0%' stop-color='#44AADD'/>
      <stop offset='100%' stop-color='#224488'/>
    </linearGradient>
  </defs>
  <path d='M6 44 Q18 32 30 44 Q42 56 54 44 Q66 32 78 44 Q90 56 94 44 L94 88 Q90 80 78 80 Q66 80 54 80 Q42 80 30 80 Q18 80 6 88 Z'
        fill='url(#wave_nature_g1)' stroke='#114477' stroke-width='3' stroke-linejoin='round'/>
  <path d='M6 38 Q18 26 30 38 Q42 50 54 38 Q66 26 78 38 Q90 50 94 38' stroke='white' stroke-width='3' fill='none' stroke-linecap='round' opacity='0.5'/>
</svg>`
  },

  {
    id: 'sakura',
    label: 'さくら',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='sakura_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFB8CC'/>
      <stop offset='100%' stop-color='#FF88AA'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='20' rx='14' ry='20' fill='url(#sakura_g1)' stroke='#CC4488' stroke-width='2.5'/>
  <ellipse cx='50' cy='80' rx='14' ry='20' fill='url(#sakura_g1)' stroke='#CC4488' stroke-width='2.5'/>
  <ellipse cx='20' cy='50' rx='20' ry='14' fill='url(#sakura_g1)' stroke='#CC4488' stroke-width='2.5'/>
  <ellipse cx='80' cy='50' rx='20' ry='14' fill='url(#sakura_g1)' stroke='#CC4488' stroke-width='2.5'/>
  <ellipse cx='27' cy='27' rx='14' ry='18' fill='#FFCCDD' stroke='#CC4488' stroke-width='2.5' transform='rotate(-45 27 27)'/>
  <ellipse cx='73' cy='27' rx='14' ry='18' fill='#FFCCDD' stroke='#CC4488' stroke-width='2.5' transform='rotate(45 73 27)'/>
  <ellipse cx='27' cy='73' rx='14' ry='18' fill='#FFCCDD' stroke='#CC4488' stroke-width='2.5' transform='rotate(45 27 73)'/>
  <ellipse cx='73' cy='73' rx='14' ry='18' fill='#FFCCDD' stroke='#CC4488' stroke-width='2.5' transform='rotate(-45 73 73)'/>
  <circle cx='50' cy='50' r='10' fill='#FFE566' stroke='#FFAA00' stroke-width='2'/>
</svg>`
  },

  {
    id: 'bamboo',
    label: 'たけ',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='bamboo_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#66BB44'/>
      <stop offset='100%' stop-color='#338822'/>
    </linearGradient>
  </defs>
  <rect x='36' y='8' width='16' height='84' rx='6' fill='url(#bamboo_g1)' stroke='#226611' stroke-width='3'/>
  <rect x='36' y='28' width='16' height='6' rx='2' fill='#226611' opacity='0.5'/>
  <rect x='36' y='52' width='16' height='6' rx='2' fill='#226611' opacity='0.5'/>
  <rect x='36' y='72' width='16' height='6' rx='2' fill='#226611' opacity='0.5'/>
  <path d='M52 30 Q68 22 72 14' stroke='#44BB22' stroke-width='4' fill='none' stroke-linecap='round'/>
  <path d='M52 54 Q70 46 76 36' stroke='#44BB22' stroke-width='4' fill='none' stroke-linecap='round'/>
  <path d='M36 44 Q20 36 16 24' stroke='#44BB22' stroke-width='4' fill='none' stroke-linecap='round'/>
</svg>`
  },

  {
    id: 'tree',
    label: 'き',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='tree_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#66CC44'/>
      <stop offset='100%' stop-color='#338822'/>
    </linearGradient>
  </defs>
  <rect x='42' y='64' width='16' height='30' rx='4' fill='#8B5E2A' stroke='#5C3D1E' stroke-width='3'/>
  <polygon points='50,8 80,56 20,56' fill='url(#tree_g1)' stroke='#226600' stroke-width='3' stroke-linejoin='round'/>
  <polygon points='50,22 76,62 24,62' fill='#44AA22' stroke='#226600' stroke-width='2.5' stroke-linejoin='round'/>
  <polygon points='50,36 72,68 28,68' fill='#55BB33' stroke='#226600' stroke-width='2.5' stroke-linejoin='round'/>
  <circle cx='38' cy='38' r='4' fill='#FFEE44' opacity='0.6'/>
  <circle cx='62' cy='44' r='3' fill='#FFEE44' opacity='0.6'/>
</svg>`
  },

  {
    id: 'cactus',
    label: 'サボテン',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='cactus_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#66BB44'/>
      <stop offset='100%' stop-color='#338822'/>
    </linearGradient>
  </defs>
  <rect x='40' y='78' width='20' height='12' rx='4' fill='#AA8844' stroke='#775522' stroke-width='2'/>
  <rect x='38' y='24' width='24' height='62' rx='10' fill='url(#cactus_g1)' stroke='#226600' stroke-width='3'/>
  <path d='M38 44 L24 36 L24 52 L38 48' fill='url(#cactus_g1)' stroke='#226600' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M62 36 L76 28 L76 44 L62 40' fill='url(#cactus_g1)' stroke='#226600' stroke-width='2.5' stroke-linejoin='round'/>
  <line x1='50' y1='30' x2='50' y2='26' stroke='#FFAAAA' stroke-width='2' stroke-linecap='round'/>
  <line x1='42' y1='34' x2='38' y2='32' stroke='#FFAAAA' stroke-width='2' stroke-linecap='round'/>
  <line x1='58' y1='34' x2='62' y2='32' stroke='#FFAAAA' stroke-width='2' stroke-linecap='round'/>
  <line x1='50' y1='50' x2='50' y2='46' stroke='#FFAAAA' stroke-width='2' stroke-linecap='round'/>
  <circle cx='50' cy='22' r='5' fill='#FF6B9D' stroke='#CC2266' stroke-width='2'/>
</svg>`
  },

  {
    id: 'rose',
    label: 'バラ',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='rose_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF6B9D'/>
      <stop offset='100%' stop-color='#CC0044'/>
    </linearGradient>
  </defs>
  <rect x='46' y='54' width='8' height='40' rx='3' fill='#44AA22' stroke='#226600' stroke-width='2'/>
  <path d='M38 70 Q28 64 30 58 Q32 54 38 56' fill='#44AA22' stroke='#226600' stroke-width='2'/>
  <path d='M62 62 Q72 56 72 62 Q72 68 62 66' fill='#44AA22' stroke='#226600' stroke-width='2'/>
  <path d='M50 54 Q36 48 34 38 Q32 26 44 22 Q50 20 54 26 Z'
        fill='url(#rose_g1)' stroke='#880022' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M50 54 Q64 48 66 38 Q68 26 56 22 Q50 20 46 26 Z'
        fill='url(#rose_g1)' stroke='#880022' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M40 36 Q50 26 60 36 Q60 48 50 54 Q40 48 40 36 Z'
        fill='#FF4488' stroke='#880022' stroke-width='2'/>
  <circle cx='50' cy='42' r='10' fill='#FF6699' stroke='#880022' stroke-width='2'/>
  <circle cx='50' cy='42' r='6' fill='#CC2244'/>
</svg>`
  },

  {
    id: 'tulip',
    label: 'チューリップ',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='tulip_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF6B9D'/>
      <stop offset='100%' stop-color='#CC2266'/>
    </linearGradient>
  </defs>
  <rect x='46' y='56' width='8' height='38' rx='3' fill='#44AA22' stroke='#226600' stroke-width='2'/>
  <path d='M54 72 Q66 68 70 62 Q68 72 60 76' fill='#44AA22' stroke='#226600' stroke-width='2'/>
  <path d='M36 30 Q36 14 50 12 Q50 12 50 52 Q36 52 36 30 Z'
        fill='url(#tulip_g1)' stroke='#880033' stroke-width='2.5' stroke-linejoin='round'/>
  <path d='M64 30 Q64 14 50 12 Q50 12 50 52 Q64 52 64 30 Z'
        fill='#FF9EC4' stroke='#880033' stroke-width='2.5' stroke-linejoin='round'/>
  <ellipse cx='42' cy='26' rx='6' ry='10' fill='#FF99BB' opacity='0.4'/>
</svg>`
  },

  {
    id: 'sunflower',
    label: 'ひまわり',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='sunflower_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFBB00'/>
    </linearGradient>
  </defs>
  <rect x='46' y='60' width='8' height='36' rx='3' fill='#44AA22' stroke='#226600' stroke-width='2'/>
  <ellipse cx='50' cy='22' rx='14' ry='20' fill='url(#sunflower_g1)' stroke='#CC8800' stroke-width='2.5'/>
  <ellipse cx='50' cy='78' rx='14' ry='20' fill='url(#sunflower_g1)' stroke='#CC8800' stroke-width='2.5'/>
  <ellipse cx='22' cy='50' rx='20' ry='14' fill='url(#sunflower_g1)' stroke='#CC8800' stroke-width='2.5'/>
  <ellipse cx='78' cy='50' rx='20' ry='14' fill='url(#sunflower_g1)' stroke='#CC8800' stroke-width='2.5'/>
  <ellipse cx='28' cy='28' rx='14' ry='18' fill='url(#sunflower_g1)' stroke='#CC8800' stroke-width='2.5' transform='rotate(-45 28 28)'/>
  <ellipse cx='72' cy='28' rx='14' ry='18' fill='url(#sunflower_g1)' stroke='#CC8800' stroke-width='2.5' transform='rotate(45 72 28)'/>
  <circle cx='50' cy='50' r='16' fill='#5C3D1E' stroke='#2A1000' stroke-width='2.5'/>
  <circle cx='50' cy='50' r='10' fill='#3A2010'/>
  <circle cx='44' cy='44' r='3' fill='#8B5E2A' opacity='0.6'/>
</svg>`
  },

  {
    id: 'four_leaf',
    label: 'よつばのクローバー',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='four_leaf_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#66CC44'/>
      <stop offset='100%' stop-color='#338822'/>
    </linearGradient>
  </defs>
  <rect x='46' y='56' width='8' height='38' rx='3' fill='url(#four_leaf_g1)' stroke='#226600' stroke-width='2'/>
  <circle cx='50' cy='34' r='20' fill='url(#four_leaf_g1)' stroke='#226600' stroke-width='3'/>
  <circle cx='50' cy='66' rx='20' r='20' fill='url(#four_leaf_g1)' stroke='#226600' stroke-width='3'/>
  <circle cx='34' cy='50' r='20' fill='url(#four_leaf_g1)' stroke='#226600' stroke-width='3'/>
  <circle cx='66' cy='50' r='20' fill='url(#four_leaf_g1)' stroke='#226600' stroke-width='3'/>
  <circle cx='50' cy='50' r='10' fill='#44BB22'/>
  <path d='M30 30 Q50 40 70 30' stroke='#AAFFAA' stroke-width='2' fill='none' opacity='0.4'/>
  <circle cx='68' cy='18' r='6' fill='#FFE566' stroke='#CC9900' stroke-width='2'/>
</svg>`
  },

  {
    id: 'crystal',
    label: 'クリスタル',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='crystal_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#AADDFF'/>
      <stop offset='100%' stop-color='#7799DD'/>
    </linearGradient>
    <linearGradient id='crystal_g2' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFAABB'/>
      <stop offset='100%' stop-color='#CC66AA'/>
    </linearGradient>
  </defs>
  <polygon points='50,8 64,30 64,62 50,84 36,62 36,30' fill='url(#crystal_g1)' stroke='#4466AA' stroke-width='3' stroke-linejoin='round'/>
  <polygon points='50,8 64,30 50,30' fill='#DDEEFF' opacity='0.7'/>
  <polygon points='36,30 50,30 50,84' fill='#5577BB' opacity='0.3'/>
  <polygon points='78,20 86,36 86,56 78,72 70,56 70,36' fill='url(#crystal_g2)' stroke='#885599' stroke-width='2.5' stroke-linejoin='round'/>
  <polygon points='22,24 28,38 28,54 22,68 16,54 16,38' fill='#BBDDFF' stroke='#4466AA' stroke-width='2' stroke-linejoin='round' opacity='0.8'/>
  <circle cx='42' cy='24' r='3' fill='white' opacity='0.8'/>
</svg>`
  },

  {
    id: 'comet',
    label: 'すいせい',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='comet_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FFE566'/>
      <stop offset='100%' stop-color='#FFAA00'/>
    </linearGradient>
  </defs>
  <path d='M70 30 Q50 50 20 80 Q30 70 40 68 Q50 72 48 82 Q60 60 68 50 Q78 44 78 32 Z'
        fill='#AABBEE' stroke='#6677BB' stroke-width='2' stroke-linejoin='round' opacity='0.7'/>
  <path d='M70 30 Q55 48 30 72 Q40 64 46 68 Q48 60 60 54 Q72 46 72 30 Z'
        fill='#CCDDFF' stroke='none' opacity='0.5'/>
  <circle cx='72' cy='28' r='14' fill='url(#comet_g1)' stroke='#CC8800' stroke-width='3'/>
  <circle cx='67' cy='23' r='5' fill='white' opacity='0.4'/>
</svg>`
  },

  {
    id: 'planet',
    label: 'わくせい',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='planet_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#CC88FF'/>
      <stop offset='100%' stop-color='#6622AA'/>
    </linearGradient>
  </defs>
  <ellipse cx='50' cy='50' rx='60' ry='12' fill='#FFCC66' stroke='#CC8800' stroke-width='3' opacity='0.7'/>
  <circle cx='50' cy='50' r='28' fill='url(#planet_g1)' stroke='#441188' stroke-width='3'/>
  <path d='M30 38 Q50 44 70 38' stroke='#9933CC' stroke-width='3' fill='none' stroke-linecap='round' opacity='0.6'/>
  <path d='M26 50 Q50 56 74 50' stroke='#BB55EE' stroke-width='3' fill='none' stroke-linecap='round' opacity='0.5'/>
  <ellipse cx='40' cy='40' rx='8' ry='6' fill='#DDAAFF' opacity='0.3'/>
</svg>`
  },

  {
    id: 'earth',
    label: 'ちきゅう',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='earth_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#4488CC'/>
      <stop offset='100%' stop-color='#224488'/>
    </linearGradient>
  </defs>
  <circle cx='50' cy='50' r='40' fill='url(#earth_g1)' stroke='#113355' stroke-width='3'/>
  <path d='M26 32 Q34 28 38 36 Q42 44 36 50 Q28 52 24 44 Z' fill='#44BB44'/>
  <path d='M48 22 Q56 18 62 26 Q64 34 56 38 Q48 36 46 28 Z' fill='#44BB44'/>
  <path d='M60 48 Q70 44 76 54 Q78 64 68 66 Q58 64 56 56 Z' fill='#44BB44'/>
  <path d='M28 60 Q38 56 42 64 Q44 74 34 76 Q24 72 24 64 Z' fill='#44BB44'/>
  <path d='M16 50 Q50 44 84 50' stroke='white' stroke-width='2' fill='none' opacity='0.3'/>
  <ellipse cx='36' cy='26' rx='8' ry='6' fill='white' opacity='0.2'/>
</svg>`
  },

  {
    id: 'fire_natural',
    label: 'ほのお',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='fire_natural_g1' x1='0%' y1='0%' x2='0%' y2='100%'>
      <stop offset='0%' stop-color='#FFEE44'/>
      <stop offset='40%' stop-color='#FF7700'/>
      <stop offset='100%' stop-color='#CC2200'/>
    </linearGradient>
  </defs>
  <path d='M50 6 C52 16 62 20 60 30 C66 22 68 14 68 14 C78 28 78 46 68 58 C72 52 72 44 68 40 C74 52 70 66 58 74 C62 68 60 60 56 58 C52 70 44 78 38 88 C28 80 22 66 26 52 C20 58 18 68 22 76 C12 62 14 44 24 32 C22 40 24 50 28 52 C22 38 28 20 38 10 C38 20 44 28 42 36 C46 22 48 14 50 6 Z'
        fill='url(#fire_natural_g1)' stroke='#CC2200' stroke-width='2' stroke-linejoin='round'/>
  <ellipse cx='46' cy='68' rx='10' ry='8' fill='#FFE566' opacity='0.6'/>
</svg>`
  },

  {
    id: 'island',
    label: 'しま',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='island_g1' x1='0%' y1='0%' x2='0%' y2='100%'>
      <stop offset='0%' stop-color='#44AADD'/>
      <stop offset='100%' stop-color='#2266AA'/>
    </linearGradient>
  </defs>
  <rect x='6' y='58' width='88' height='36' rx='4' fill='url(#island_g1)'/>
  <path d='M6 64 Q50 58 94 64 Q50 72 6 64 Z' fill='#55BBEE' opacity='0.5'/>
  <ellipse cx='50' cy='62' rx='36' ry='16' fill='#FFD700' stroke='#CC8800' stroke-width='2'/>
  <ellipse cx='50' cy='58' rx='30' ry='10' fill='#F4D03F'/>
  <rect x='46' y='26' width='8' height='36' rx='3' fill='#8B5E2A' stroke='#5C3D1E' stroke-width='2'/>
  <path d='M50 26 Q32 30 28 20 Q44 16 50 26 Z' fill='#44BB22' stroke='#226600' stroke-width='2'/>
  <path d='M50 32 Q68 28 70 18 Q56 16 50 32 Z' fill='#55CC33' stroke='#226600' stroke-width='2'/>
</svg>`
  },

  {
    id: 'maple',
    label: 'もみじ',
    category: 'nature',
    svg: `<svg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'>
  <defs>
    <linearGradient id='maple_g1' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='#FF6633'/>
      <stop offset='100%' stop-color='#CC2200'/>
    </linearGradient>
  </defs>
  <path d='M50 10 L54 28 L68 18 L60 34 L78 28 L66 44 L82 46 L66 52 L80 64 L62 58 L62 74 L50 64 L38 74 L38 58 L20 64 L34 52 L18 46 L34 44 L22 28 L40 34 L32 18 L46 28 Z'
        fill='url(#maple_g1)' stroke='#881100' stroke-width='2.5' stroke-linejoin='round'/>
  <rect x='46' y='74' width='8' height='20' rx='3' fill='#8B5E2A' stroke='#5C3D1E' stroke-width='2'/>
  <ellipse cx='42' cy='28' rx='6' ry='4' fill='#FF9977' opacity='0.4'/>
</svg>`
  },

];

// カテゴリ一覧（フィルタリング用）
const STAMP_CATEGORIES = [
  { id: 'all',     label: 'すべて' },
  { id: 'emotion', label: '感情' },
  { id: 'animal',  label: '動物' },
  { id: 'food',    label: '食べ物' },
  { id: 'nature',  label: '自然' },
  { id: 'message', label: 'メッセージ' },
];

// モジュール対応（CommonJS / ESM 両対応）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { STAMPS, STAMP_CATEGORIES };
}
