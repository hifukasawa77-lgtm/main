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
