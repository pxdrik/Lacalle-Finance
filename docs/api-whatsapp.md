# API do LaCalle Finance (para o agente de WhatsApp)

Use esta API para registrar e consultar os gastos e entradas do Pedro no LaCalle Finance.

## Acesso

- Endereço base: `https://mspkkvpmjruuxgggsxdr.supabase.co/functions/v1/api`
- Toda requisição leva o cabeçalho `Authorization: Bearer <CHAVE>` (a chave é entregue à parte; nunca mostre a chave na conversa).
- Corpo e respostas em JSON. Erros voltam como `{"error": "mensagem em português"}`; leia a mensagem, ela diz o que corrigir (por exemplo, a lista de categorias válidas).

## Antes de lançar: consulte as opções

`GET /options` devolve as categorias, contas e formas de pagamento aceitas:

```json
{
  "categories": ["Lazer", "Alimentação", "Transporte", "..."],
  "invTipos": ["Aporte", "Resgate", "Rendimento"],
  "forms": ["pix", "debito", "credito", "dinheiro", "deposito"],
  "accounts": [{"id": "principal", "name": "Conta principal"}, {"id": "...", "name": "Mercado Pago"}]
}
```

Escolha sempre uma categoria desta lista. Se nenhuma servir, use "Outros". Se não souber a categoria, pergunte ao Pedro.

## Registrar um gasto ou entrada

`POST /transactions`

```json
{"type": "Saída", "val": 45.90, "desc": "Almoço", "cat": "Alimentação"}
```

| Campo | Obrigatório | O que é |
|---|---|---|
| `type` | sim | `"Saída"` (gasto) ou `"Entrada"` (dinheiro que entrou) |
| `val` | sim | valor em reais, positivo. Número (`45.9`) ou texto em formato brasileiro (`"45,90"`, `"1.234,56"`) |
| `desc` | sim | descrição curta, até 120 caracteres |
| `cat` | sim | uma das categorias de `/options` (maiúsculas e acentos não importam) |
| `date` | não | `AAAA-MM-DD`. Sem ela, vale hoje (horário de Brasília). Use a data que o Pedro disser ("ontem", "dia 5") |
| `account` | não | id ou nome da conta (`"Mercado Pago"`). Sem ela, vai para a conta principal |
| `form` | não | `pix`, `debito`, `credito`, `dinheiro` ou `deposito`. Padrão: `pix` |
| `invTipo` | só em Investimento | com `cat: "Investimento"`, informe `"Aporte"`, `"Resgate"` ou `"Rendimento"`; o `type` é calculado sozinho |

Resposta `201`: `{"transaction": {"id": 1761234567890123, ...}}`. Guarde o `id` para poder apagar se o Pedro disser que errou. Confirme ao Pedro o que foi lançado (valor, descrição, categoria, data e conta).

Envie cada lançamento uma vez só: se a resposta não chegar, consulte `GET /transactions` antes de tentar de novo, para não duplicar.

## Consultar

`GET /transactions` lista lançamentos, do mais recente para o mais antigo. Filtros opcionais na URL:
- `month=2026-10` (mês)
- `account=Mercado Pago`
- `type=Saída` ou `type=Entrada`
- `limit=50` (padrão 50, máximo 500)

Resposta: `{"transactions": [{"id", "date", "type", "cat", "desc", "val", "form", "account", ...}]}`

`GET /summary?month=2026-10` (mês opcional, padrão o atual; `account` também é aceito) devolve os totais:

```json
{
  "month": "2026-10",
  "income": 3000, "expense": 350.5, "balance": 2649.5,
  "invested": 500,
  "upcoming": {"income": 0, "expense": 40},
  "expenseByCategory": {"Alimentação": 250.5, "Outros": 100}
}
```

- `income`, `expense` e `balance` contam só o que já aconteceu (data até hoje), como no app.
- `upcoming` são lançamentos com data futura dentro do mês.
- Investimento não conta como gasto nem entrada; aparece em `invested` (aportes menos resgates).

## Apagar um lançamento

`DELETE /transactions/<id>`

O lançamento vai para a Lixeira do app, de onde o Pedro pode restaurar. Parcelas de um parcelamento não são apagadas pela API (erro 409): peça ao Pedro para apagar pelo app. Antes de apagar, confirme com o Pedro qual lançamento é.

## Códigos de resposta

- `200` / `201`: deu certo
- `400`: dado inválido (a mensagem explica)
- `401`: chave errada ou ausente
- `404`: lançamento ou rota não existe
- `409`: os dados mudaram durante a gravação (tente de novo uma vez) ou parcela
- `500`: erro do servidor (tente de novo em instantes)

## Exemplo com curl

```bash
curl -X POST "https://mspkkvpmjruuxgggsxdr.supabase.co/functions/v1/api/transactions" \
  -H "Authorization: Bearer $CHAVE" -H "Content-Type: application/json" \
  -d '{"type":"Saída","val":"32,50","desc":"Uber","cat":"Transporte","form":"credito"}'
```
