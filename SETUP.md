# Configuração — FotoMapa (Parte 2)

Esta etapa adiciona **persistência**: cada foto é enviada ao **Cloudinary** e a
URL + localização são salvas no **Firestore**. Ao abrir o app, os marcadores
salvos são recarregados automaticamente.

## 1. Cloudinary (upload unsigned)

1. Crie uma conta em <https://cloudinary.com>.
2. Em **Settings → Upload → Upload presets**, crie um preset com
   **Signing Mode = Unsigned**.
3. Em `src/services/cloudinaryService.js`, preencha:
   - `CLOUD_NAME` → o *Cloud name* do Dashboard.
   - `UPLOAD_PRESET` → o nome do preset criado.

A API Secret **não** é usada no app (requisito de segurança).

## 2. Firebase / Firestore

1. Crie um projeto em <https://console.firebase.google.com>.
2. Em **Build → Firestore Database**, crie o banco (modo de teste no dev).
3. Em **Configurações do projeto → Seus apps → Web**, registre um app Web e
   copie o `firebaseConfig` para `src/services/firebase.js`.
4. Na aba **Rules**, publique regras que permitam acesso à coleção `markers`.
   Para este trabalho acadêmico (sem login):

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /markers/{id} {
         allow read, write: if true;
       }
     }
   }
   ```

   > ⚠️ `if true` libera acesso público — não use em produção. O erro
   > "Missing or insufficient permissions" indica regras bloqueando o acesso.

A coleção usada é `markers`, com o modelo:

```
{ imageUrl: string, publicId: string, latitude: number, longitude: number, createdAt: timestamp }
```

## 3. Rodar

```
npx expo start
```

---

## Limitação: exclusão da imagem no Cloudinary

O requisito RF06 pede para, se possível, remover também a imagem do Cloudinary.

A exclusão de um recurso no Cloudinary exige uma requisição **assinada** com a
**API Secret**. Manter a API Secret dentro do app cliente é uma falha de
segurança (qualquer um poderia extraí-la e apagar/alterar a conta). A forma
correta seria um **backend** (ex.: Cloud Function) que recebe o `publicId` e faz
a chamada assinada com segurança.

Por isso, nesta entrega a exclusão remove **apenas o documento do Firestore**
(o marcador desaparece do mapa imediatamente). O `publicId` é guardado em cada
documento justamente para viabilizar essa exclusão server-side no futuro.
