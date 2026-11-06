# Guia prático de Tailwind CSS e estilos

Este tutorial mostra como configurar e aplicar estilos com Tailwind CSS neste
projeto. Ele também propõe uma organização de tokens que pode servir de base
para um futuro editor de temas para diferentes sites.

## 1. Como o Tailwind está configurado aqui

O projeto usa Tailwind CSS 4.x (dependência `^4.3.4`) e a configuração CSS-first
da versão 4. Não há um `tailwind.config.js` para editar.

- [`postcss.config.mjs`](./postcss.config.mjs) ativa o plugin
  `@tailwindcss/postcss`.
- [`src/app/globals.css`](./src/app/globals.css) importa Tailwind com
  `@import "tailwindcss";` e declara os estilos e tokens globais.
- [`src/app/layout.tsx`](./src/app/layout.tsx) importa a folha global para
  aplicá-la ao site todo.

Exemplo mínimo da configuração PostCSS:

```js
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
```

### Criando uma utility própria

No Tailwind 4, `@theme` define tokens que também criam utilities. Por exemplo:

```css
@import "tailwindcss";

@theme {
  --color-brand: #4f5fc8;
  --font-display: "Geist", sans-serif;
}
```

Isso disponibiliza classes como `bg-brand`, `text-brand` e `font-display`.
Variáveis CSS comuns, declaradas em `:root`, continuam úteis, mas não criam
utilities automaticamente.

## 2. Como ler uma `className`

Cada utility controla uma propriedade ou um pequeno grupo de propriedades:

```tsx
<section className="flex items-center gap-4 rounded-xl border p-5">
  ...
</section>
```

Nesse exemplo, `flex` define o layout, `items-center` alinha os itens,
`gap-4` controla o espaço entre eles, `rounded-xl` arredonda os cantos,
`border` adiciona borda e `p-5` aplica espaçamento interno.

É comum combinar utilities de layout, espaço, tipografia e cor no mesmo
elemento. Cada classe continua explícita e pode ser alterada sem criar um
seletor global que afete componentes não relacionados.

## 3. Referência rápida de utilities

| Necessidade | Exemplos | O que fazem |
| --- | --- | --- |
| Layout | `flex`, `grid`, `block`, `hidden` | Define como os elementos são organizados |
| Alinhamento | `items-center`, `justify-between`, `place-items-center` | Alinha itens em Flexbox ou Grid |
| Espaço | `p-4`, `px-6`, `mt-3`, `gap-4`, `space-y-3` | Define padding, margem e distância |
| Tamanho | `w-full`, `h-10`, `min-h-screen`, `max-w-4xl` | Define largura e altura |
| Texto | `text-sm`, `font-semibold`, `leading-6` | Define tamanho, peso e altura de linha |
| Cor | `bg-white`, `text-slate-700`, `border-slate-200` | Define fundo, texto e borda |
| Acabamento | `rounded-xl`, `shadow-sm`, `ring-1` | Define cantos, sombras e contornos |
| Estado | `hover:bg-indigo-700`, `focus-visible:ring-2` | Define o visual em estados de interação |

### Espaçamento

O espaçamento padrão usa uma escala baseada em unidades de `0.25rem`:

| Utility | Valor aproximado | Uso comum |
| --- | --- | --- |
| `p-1` / `gap-1` | `0.25rem` | Espaço muito compacto |
| `p-2` / `gap-2` | `0.5rem` | Controles próximos |
| `p-4` / `gap-4` | `1rem` | Espaçamento geral |
| `p-6` / `gap-6` | `1.5rem` | Separação entre grupos |
| `p-8` / `gap-8` | `2rem` | Espaçamento amplo |

Use a escala antes de inventar medidas. Ela ajuda a manter ritmo visual
consistente entre páginas.

### Tamanho de texto

| Utility | Tamanho padrão aproximado | Uso comum |
| --- | --- | --- |
| `text-xs` | `0.75rem` | Metadados e etiquetas |
| `text-sm` | `0.875rem` | Texto auxiliar e controles |
| `text-base` | `1rem` | Texto de leitura |
| `text-lg` | `1.125rem` | Títulos de seção pequenos |
| `text-xl` / `text-2xl` | `1.25rem` / `1.5rem` | Títulos de seção ou página |
| `text-3xl` / `text-4xl` | `1.875rem` / `2.25rem` | Destaques e títulos grandes |

Combine tamanho com peso e legibilidade:

```html
<h1 class="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
  Título da página
</h1>
<p class="mt-2 text-sm leading-6 text-slate-600">
  Texto de apoio confortável para leitura.
</p>
```

Evite usar texto minúsculo para informações essenciais. Para textos longos,
priorize bom contraste, altura de linha generosa (`leading-6` ou maior) e uma
largura de leitura limitada.

## 4. Layout de páginas e responsividade

Tailwind é mobile-first: as utilities sem prefixo são a base para telas
pequenas; prefixos como `sm:` e `lg:` aplicam mudanças naquele tamanho e acima.

Breakpoints padrão:

| Prefixo | A partir de |
| --- | --- |
| `sm:` | `40rem` |
| `md:` | `48rem` |
| `lg:` | `64rem` |
| `xl:` | `80rem` |
| `2xl:` | `96rem` |

Uma estrutura comum para uma página:

```tsx
<main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <section>{/* Conteúdo principal */}</section>
    <aside>{/* Painel complementar */}</aside>
  </div>
</main>
```

- `mx-auto` centraliza o conteúdo.
- `w-full` ocupa a largura disponível.
- `max-w-7xl` evita que o conteúdo fique largo demais em monitores grandes.
- `px-4 sm:px-6 lg:px-8` aumenta o respiro conforme a tela cresce.
- `grid-cols-1 lg:grid-cols-[...]` empilha no celular e cria colunas em telas
  maiores.

Prefira larguras máximas (`max-w-*`) em vez de larguras fixas para a página
inteira. Use medidas arbitrárias, como `max-w-[1100px]`, somente quando a escala
padrão não representar o design desejado.

## 5. Cores e temas

### Paleta padrão

Tailwind oferece famílias como `slate`, `zinc`, `blue`, `indigo`, `emerald`,
`amber` e `rose`, cada uma com diferentes intensidades. Exemplos:

```html
<div class="border border-slate-200 bg-white text-slate-900">
  <p class="text-slate-600">Texto secundário</p>
  <button class="bg-indigo-600 text-white hover:bg-indigo-700">
    Continuar
  </button>
</div>
```

Use tons claros para fundos, tons médios para decoração e tons escuros para
texto em fundos claros. Uma classe como `text-amber-100` foi pensada para
contrastar com superfícies escuras; em uma superfície clara, o texto pode ficar
quase invisível. Nesse caso, use uma cor escura para o texto e mantenha o fundo
colorido e suave, por exemplo `bg-amber-50 text-amber-900`.

Opacidade pode ser escrita como parte da utility:

```html
<div class="border border-indigo-500/20 bg-indigo-500/10 text-indigo-900">
  Aviso com fundo discreto e texto legível.
</div>
```

Opacidade baixa funciona bem em bordas e fundos; evite usá-la em texto pequeno
ou em informações importantes.

### Tokens semânticos para light e dark

Um tema deve descrever o papel de uma cor, não apenas seu valor hexadecimal.
Por exemplo, `surface` identifica o fundo de um painel mesmo que esse fundo
seja branco no tema claro e grafite no tema escuro.

Este projeto já define tokens como `--background`, `--surface`, `--raised`,
`--heading`, `--muted`, `--line` e `--accent` em
[`src/app/globals.css`](./src/app/globals.css). O tema escuro é o padrão; o
claro troca os valores em `:root[data-theme="light"]`.

Para criar utilities com nomes semânticos em um projeto Tailwind 4, conecte
tokens CSS ao `@theme inline`:

```css
:root {
  --app-background: #f5f7fb;
  --app-surface: #ffffff;
  --app-foreground: #273241;
  --app-muted: #526173;
  --app-line: #d5deeb;
  --app-accent: #4f5fc8;
}

:root[data-theme="dark"] {
  --app-background: #0e1117;
  --app-surface: #141920;
  --app-foreground: #d7dce3;
  --app-muted: #9aa4b2;
  --app-line: #303844;
  --app-accent: #a6b0bd;
}

@theme inline {
  --color-app-background: var(--app-background);
  --color-app-surface: var(--app-surface);
  --color-app-foreground: var(--app-foreground);
  --color-app-muted: var(--app-muted);
  --color-app-line: var(--app-line);
  --color-app-accent: var(--app-accent);
}
```

Isso disponibiliza, por exemplo, `bg-app-background`, `bg-app-surface`,
`text-app-foreground`, `text-app-muted`, `border-app-line` e `bg-app-accent`.
O tema pode trocar os valores dos tokens sem mudar as utilities dos
componentes.

No FeedSync, a seleção do tema é aplicada ao elemento `<html>` por
`data-theme`, e a escolha fica guardada no navegador. A folha atual usa
principalmente variáveis CSS e regras de compatibilidade para componentes que
ainda têm cores fixas. Para novas telas, prefira utilities semânticas ou
`bg-[var(--surface)]` e `text-[var(--foreground)]`; evite adicionar mais cores
escuras fixas que precisem de correção no tema claro.

> A variante Tailwind `dark:` usa `prefers-color-scheme` por padrão. Para
> controlá-la manualmente com um seletor próprio, é necessário configurar
> `@custom-variant dark` no CSS. Como o FeedSync usa `data-theme="light"` para
> ativar o claro e não depende de `dark:*`, mantenha o padrão atual ou configure
> explicitamente a variante antes de introduzir essas classes.

## 6. Padrões prontos para componentes

### Card

```tsx
<section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
  <h2 className="text-lg font-semibold text-slate-900">Resumo</h2>
  <p className="mt-2 text-sm leading-6 text-slate-600">
    Conteúdo auxiliar do painel.
  </p>
</section>
```

### Botão acessível

```tsx
<button
  type="button"
  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
>
  Salvar alterações
</button>
```

Inclua estados de hover, foco e desabilitado. `focus-visible:` é importante
para que seja possível identificar o foco ao navegar pelo teclado.

### Campo de formulário

```tsx
<label className="block space-y-1.5">
  <span className="text-sm font-medium text-slate-800">Nome</span>
  <input
    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-indigo-600"
    placeholder="Seu nome"
  />
</label>
```

O rótulo deve continuar visível quando o campo está vazio; placeholder não deve
ser o único nome do campo.

## 7. Boas práticas

1. **Comece pelo celular.** Faça o layout base sem prefixo e adicione
   `sm:`, `md:` ou `lg:` para as mudanças necessárias.
2. **Use a escala existente.** Prefira `p-4`, `gap-3`, `text-sm` e `max-w-4xl`
   a valores arbitrários repetidos.
3. **Use cores semânticas.** Diferencie fundo, superfície, texto principal,
   texto secundário, borda e destaque. Não use `text-white` automaticamente em
   uma cor de fundo clara.
4. **Confira contraste.** Busque pelo menos 4.5:1 para texto normal e 3:1 para
   texto grande. Não comunique sucesso, erro ou seleção somente pela cor:
   inclua rótulo, ícone ou outra indicação.
5. **Evite construir classes em partes.** Tailwind procura nomes completos nos
   arquivos e não consegue inferir strings como
   `` `text-${color}-600` ``. Prefira um mapa com classes completas:

   ```tsx
   const statusClasses = {
     success: 'bg-emerald-50 text-emerald-900',
     warning: 'bg-amber-50 text-amber-900',
     error: 'bg-rose-50 text-rose-900',
   } as const;
   ```

6. **Reutilize componentes.** Se o mesmo grupo de classes aparece em vários
   lugares, extraia um componente visual (por exemplo, `Button`, `Card` ou
   `FormField`) antes de criar regras globais difíceis de rastrear.
7. **Use CSS global com moderação.** Reserve `globals.css` para tokens,
   estilos base e regras realmente compartilhadas. Prefira utilities para
   estilos locais; evite seletores amplos que tentem sobrescrever todas as
   classes de cor do projeto.
8. **Valide os dois temas e tamanhos de tela.** Confira pelo menos uma tela
   pequena e uma larga, nos temas claro e escuro, incluindo foco de teclado,
   placeholders, mensagens de erro e estados vazios.

Depois de alterar os estilos, valide a compilação com `npm run build`.

## 8. Preparando um futuro editor de temas

Um editor visual fica mais simples quando os estilos são organizados por
tokens, e não por milhares de classes individuais. Um primeiro modelo de tema
pode separar valores por papel e aparência:

```json
{
  "light": {
    "background": "#f5f7fb",
    "surface": "#ffffff",
    "foreground": "#273241",
    "muted": "#526173",
    "accent": "#4f5fc8"
  },
  "dark": {
    "background": "#0e1117",
    "surface": "#141920",
    "foreground": "#d7dce3",
    "muted": "#9aa4b2",
    "accent": "#a6b0bd"
  },
  "shape": {
    "cardRadius": "1rem",
    "pageWidth": "80rem"
  }
}
```

O editor pode alterar esses valores em um ponto central; os componentes seguem
usando nomes estáveis como `background`, `surface` e `accent`. Para dar suporte
a isso, mantenha separadas as categorias de cor, tipografia, espaçamento,
largura de conteúdo, bordas e sombras. Valide valores antes de salvar e
verifique o contraste das combinações de texto e fundo.

## 9. Documentação oficial

- [Theme variables](https://tailwindcss.com/docs/theme)
- [Responsive design](https://tailwindcss.com/docs/responsive-design)
- [Dark mode](https://tailwindcss.com/docs/dark-mode)
- [Hover, focus, and other states](https://tailwindcss.com/docs/hover-focus-and-other-states)
- [Detecting classes in source files](https://tailwindcss.com/docs/detecting-classes-in-source-files)
