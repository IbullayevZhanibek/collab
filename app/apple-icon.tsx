import { ImageResponse } from 'next/og'

// iOS home-screen иконка 180×180 с фирменным знаком Collab.
// Рендерим div'ами (ImageResponse не поддерживает произвольный SVG):
// брендовая плашка + три «карточки» убывающей высоты.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 45,
          background: 'linear-gradient(135deg, #818cf8 0%, #6366f1 55%, #4f46e5 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, height: 90 }}>
          <div style={{ width: 25, height: 90, borderRadius: 13, background: '#fff' }} />
          <div style={{ width: 25, height: 62, borderRadius: 13, background: 'rgba(255,255,255,0.82)' }} />
          <div style={{ width: 25, height: 36, borderRadius: 13, background: 'rgba(255,255,255,0.62)' }} />
        </div>
      </div>
    ),
    { ...size }
  )
}
