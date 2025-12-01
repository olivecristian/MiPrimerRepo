import { supabase } from './supabaseClient.js'

let currentUserId = null

// ---------- LOGIN ----------
export async function login() {
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const result = document.getElementById('login-result')

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    result.textContent = '❌ Error: ' + error.message
    return
  }

  currentUserId = data.user.id

  const { data: userProfile, error: profileError } = await supabase
    .from('users')
    .select('name, role')
    .eq('id', currentUserId)
    .single()

  if (profileError) {
    result.textContent = '✅ Sesión iniciada, pero no se encontró perfil.'
  } else {
    result.textContent = `✅ ¡Hola ${userProfile.name}! Sos ${userProfile.role}.`
  }

  // Mostrar secciones y cargar datos
  document.getElementById('chat-section').style.display = 'block'
  document.getElementById('messages-section').style.display = 'block'
  loadUsersList()
  loadMessages()
}

window.login = login

// ---------- MENSAJE DE TEXTO ----------
export async function sendMessage() {
  const receiverId = document.getElementById('receiver-id').value
  const content = document.getElementById('message-content').value
  const status = document.getElementById('message-status')

  if (!currentUserId) {
    status.textContent = '❗ No hay usuario logueado.'
    return
  }

  if (!receiverId) {
    status.textContent = '❗ Seleccioná un destinatario.'
    return
  }

  if (!content.trim()) {
    status.textContent = '❗ Escribí un mensaje.'
    return
  }

  const { error } = await supabase
    .from('messages')
    .insert([
      {
        sender_id: currentUserId,
        receiver_id: receiverId,
        content: content,
        type: 'texto' // 👈 IMPORTANTE
      }
    ])

  if (error) {
    status.textContent = '❌ Error al enviar el mensaje: ' + error.message
  } else {
    status.textContent = '✅ Mensaje enviado con éxito.'
    document.getElementById('message-content').value = ''
    loadMessages()
  }
}

window.sendMessage = sendMessage

// ---------- CARGAR MENSAJES ----------
async function loadMessages() {
  const list = document.getElementById('messages-list')
  list.innerHTML = 'Cargando mensajes...'

  if (!currentUserId) {
    list.innerHTML = 'No hay usuario logueado.'
    return
  }

  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('sender_id, receiver_id, content, sent_at, type')
    .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
    .order('sent_at', { ascending: false })

  if (messagesError) {
    list.innerHTML = '❌ Error al cargar mensajes: ' + messagesError.message
    return
  }

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name')

  if (usersError) {
    list.innerHTML = '❌ Error al cargar usuarios: ' + usersError.message
    return
  }

  const userMap = {}
  users.forEach(user => {
    userMap[user.id] = user.name
  })

  list.innerHTML = ''

  if (messages.length === 0) {
    list.innerHTML = 'No hay mensajes aún.'
    return
  }

  messages.forEach(msg => {
    const isSent = msg.sender_id === currentUserId
    const counterpartId = isSent ? msg.receiver_id : msg.sender_id
    const name = userMap[counterpartId] || 'Usuario desconocido'

    const el = document.createElement('div')

    // 🔊 Detectamos audio por el prefijo [AUDIO]
    if (msg.content.startsWith('[AUDIO]')) {
      const audioUrl = msg.content.replace('[AUDIO] ', '')
      el.innerHTML = `${isSent ? '▶️ Enviado a' : '📥 Recibido de'} ${name}: 
        <audio controls src="${audioUrl}"></audio>
        <br><small>${new Date(msg.sent_at).toLocaleString()}</small>`
    } else {
      el.innerHTML = `${isSent ? '▶️ Enviado a' : '📥 Recibido de'} ${name}: 
        ${msg.content}
        <br><small>${new Date(msg.sent_at).toLocaleString()}</small>`
    }

    list.appendChild(el)
  })
}

// ---------- CARGAR LISTA DE USUARIOS ----------
async function loadUsersList() {
  const select = document.getElementById('receiver-id')
  select.innerHTML = '<option value="">Seleccioná un destinatario</option>'

  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, role')

  if (error) {
    console.error('Error cargando usuarios:', error.message)
    return
  }

  users.forEach(user => {
    if (user.id !== currentUserId) {
      const option = document.createElement('option')
      option.value = user.id
      option.textContent = `${user.name} (${user.role})`
      select.appendChild(option)
    }
  })
}

// ---------- AUDIOS ----------
let mediaRecorder
let audioChunks = []

const startBtn = document.getElementById('start-recording')
const stopBtn = document.getElementById('stop-recording')
const statusText = document.getElementById('recording-status')

if (startBtn && stopBtn) {
  startBtn.addEventListener('click', async () => {
    const receiverId = document.getElementById('receiver-id').value

    if (!currentUserId) {
      statusText.textContent = '❗ Tenés que iniciar sesión primero.'
      return
    }

    if (!receiverId) {
      statusText.textContent = '❗ Seleccioná un destinatario antes de grabar.'
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder = new MediaRecorder(stream)
      audioChunks = []

      mediaRecorder.addEventListener('dataavailable', event => {
        audioChunks.push(event.data)
      })

      mediaRecorder.addEventListener('stop', async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
        const filename = `audio_${currentUserId}_${Date.now()}.webm`

        // 1) Subir a Storage
        const { error: uploadError } = await supabase.storage
          .from('audios')
          .upload(filename, audioBlob, {
            contentType: 'audio/webm',
            upsert: true
          })

        if (uploadError) {
          statusText.textContent = `❌ Error al subir audio: ${uploadError.message}`
          console.error('Error al subir audio:', uploadError)
          return
        }

        // 2) Obtener URL pública
        const { data: publicData } = supabase.storage
          .from('audios')
          .getPublicUrl(filename)

        const publicUrl = publicData.publicUrl

        // 3) Insertar mensaje en la tabla messages
        const { error: insertError } = await supabase
          .from('messages')
          .insert([
            {
              sender_id: currentUserId,
              receiver_id: receiverId,
              content: `[AUDIO] ${publicUrl}`,
              type: 'audio' // 👈 IMPORTANTE
            }
          ])

        if (insertError) {
          statusText.textContent =
            '❌ Error al guardar el mensaje de audio: ' + insertError.message
          console.error('Error insert mensaje:', insertError)
          return
        }

        statusText.textContent = '✅ Audio enviado con éxito!'
        loadMessages()
      })

      mediaRecorder.start()
      statusText.textContent = '⏺️ Grabando...'
      startBtn.disabled = true
      stopBtn.disabled = false
    } catch (err) {
      console.error('Error al acceder al micrófono:', err)
      statusText.textContent =
        '❌ No se pudo acceder al micrófono (¿permisos, HTTPS, etc?).'
    }
  })

  stopBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
      startBtn.disabled = false
      stopBtn.disabled = true
      statusText.textContent = '⏹️ Procesando audio...'
    }
  })
}
