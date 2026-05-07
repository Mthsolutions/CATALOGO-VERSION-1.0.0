import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

/* ================= FIREBASE ================= */

const firebaseConfig = {
  apiKey: "AIzaSyCmWszDrWHTQ5PXK_dxnayhxMmvHfKzeBU",
  authDomain: "catalogoteste2.firebaseapp.com",
  projectId: "catalogoteste2",
  storageBucket: "catalogoteste2.firebasestorage.app",
  messagingSenderId: "1040593537973",
  appId: "1:1040593537973:web:714986bb161e996ab167fc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const secondaryApp = initializeApp(firebaseConfig, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

/* ================= DADOS ================= */

let produtos = [];
let categorias = [];
let tabelasComerciais = [];

let empresa = {
  nome: "REI DA MUSSARELA",
  cnpj: "",
  telefone: "",
  logo: ""
};

let usuarioAtual = null;

let dadosUsuarioAtual = {
  nome: "",
  email: "",
  permissao: "vendedor",
  tabelaVinculada: ""
};

/* ================= HELPERS ================= */

function paraMaiusculo(texto) {
  return String(texto || "").trim().toUpperCase();
}

function isAdmin() {
  return dadosUsuarioAtual.permissao === "admin";
}

function tabelaUsuario() {
  return paraMaiusculo(dadosUsuarioAtual.tabelaVinculada);
}

function tipoUsuario() {
  return String(dadosUsuarioAtual.permissao || "").trim().toLowerCase();
}

function gerarCodigo() {
  return String(produtos.length + 1).padStart(6, "0");
}

function formatarTipo(tipo) {
  if (tipo === "representante_comfro") return "REPRESENTANTE COMFRO";
  if (tipo === "representante") return "REPRESENTANTE";
  if (tipo === "vendedor") return "VENDEDOR";
  if (tipo === "admin") return "ADMIN";

  return paraMaiusculo(tipo);
}

function formatarValor(valor) {
  const numero = String(valor || "0")
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (isNaN(numero)) return valor;

  return Number(numero).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function normalizarValorXLS(valor) {
  return String(valor || "")
    .replace("R$", "")
    .replace(/\s/g, "")
    .trim();
}

function imagemPadrao() {
  return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1050" height="1050">
      <rect width="100%" height="100%" fill="#f5f5f5"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
      fill="#777" font-size="52" font-family="Arial">
        SEM IMAGEM
      </text>
    </svg>
  `);
}

function fecharMenuMobileDepoisClique() {
  const menu = document.getElementById("menuLateral");

  if (menu && window.innerWidth <= 768) {
    menu.classList.remove("ativo");
  }
}

/* ================= MENU ================= */

function toggleMenuMobile() {
  document.getElementById("menuLateral").classList.toggle("ativo");
}

/* ================= LOGIN ================= */

async function fazerLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const senha = document.getElementById("loginSenha").value.trim();
  const erro = document.getElementById("loginErro");

  erro.textContent = "";

  if (!email || !senha) {
    erro.textContent = "DIGITE EMAIL E SENHA.";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (error) {
    erro.textContent = "EMAIL OU SENHA INVÁLIDOS.";
  }
}

async function logoutSistema() {
  await signOut(auth);
}

onAuthStateChanged(auth, async user => {
  if (user) {
    usuarioAtual = user;

    await carregarUsuario(user);
    await carregarFirebase();

    document.getElementById("telaLogin").classList.add("oculto");
    document.getElementById("sistema").classList.remove("oculto");

    aplicarPermissoes();
    renderizarCatalogo();
  } else {
    usuarioAtual = null;

    document.getElementById("telaLogin").classList.remove("oculto");
    document.getElementById("sistema").classList.add("oculto");
  }
});

async function carregarUsuario(user) {
  let dados = null;

  const snapUid = await getDoc(doc(db, "usuarios", user.uid));

  if (snapUid.exists()) {
    dados = snapUid.data();
  } else {
    const snapAdmin = await getDoc(doc(db, "usuarios", "admin"));

    if (snapAdmin.exists() && snapAdmin.data().email === user.email) {
      dados = snapAdmin.data();
    }
  }

  if (!dados) {
    dados = {
      nome: user.email,
      email: user.email,
      permissao: "vendedor",
      tabelaVinculada: ""
    };
  }

  dadosUsuarioAtual = {
    nome: paraMaiusculo(dados.nome || user.email),
    email: dados.email || user.email,
    permissao: dados.permissao || "vendedor",
    tabelaVinculada: paraMaiusculo(dados.tabelaVinculada || "")
  };

  document.getElementById("usuarioNome").textContent = dadosUsuarioAtual.nome;
  document.getElementById("usuarioPermissao").textContent = formatarTipo(dadosUsuarioAtual.permissao);
  document.getElementById("usuarioTabela").textContent = dadosUsuarioAtual.tabelaVinculada || "SEM TABELA";
}

function aplicarPermissoes() {
  document.querySelectorAll(".admin-only").forEach(item => {
    item.style.display = isAdmin() ? "" : "none";
  });
}

/* ================= FIRESTORE ================= */

async function salvarFirebase() {
  await setDoc(doc(db, "catalogo", "dados"), {
    produtos,
    categorias,
    tabelasComerciais,
    empresa,
    atualizadoEm: new Date().toISOString()
  });
}

async function carregarFirebase() {
  const snap = await getDoc(doc(db, "catalogo", "dados"));

  if (snap.exists()) {
    const dados = snap.data();

    produtos = dados.produtos || [];
    categorias = dados.categorias || ["LATICÍNIOS", "CONGELADOS", "EMBUTIDOS", "BEBIDAS"];
    tabelasComerciais = dados.tabelasComerciais || [];
    empresa = dados.empresa || empresa;
  } else {
    produtos = [];
    categorias = ["LATICÍNIOS", "CONGELADOS", "EMBUTIDOS", "BEBIDAS"];
    tabelasComerciais = [];

    await salvarFirebase();
  }

  normalizarDados(false);
  atualizarEmpresaTela();
  atualizarSelectCategorias();
  atualizarDashboard();
}

function normalizarDados(salvar = true) {
  categorias = [...new Set(categorias.map(c => paraMaiusculo(c)))].sort();

  tabelasComerciais = tabelasComerciais.map(tabela => ({
    id: tabela.id || Date.now() + Math.floor(Math.random() * 9999),
    nome: paraMaiusculo(tabela.nome),
    tipo: tabela.tipo || "vendedor"
  }));

  produtos = produtos.map(produto => {
    produto.id = produto.id || Date.now() + Math.floor(Math.random() * 9999);
    produto.codigo = produto.codigo || gerarCodigo();
    produto.nome = paraMaiusculo(produto.nome);
    produto.categoria = paraMaiusculo(produto.categoria || "SEM CATEGORIA");
    produto.descricao = paraMaiusculo(produto.descricao || "");
    produto.ativo = produto.ativo !== false;
    produto.imagem = produto.imagem || "";

    if (!produto.tabelas && produto.precos) {
      produto.tabelas = produto.precos.map(preco => ({
        nomeTabela: paraMaiusculo(preco.nomeTabela || "TABELA PADRÃO"),
        tipoTabela: preco.tipoTabela || "vendedor",
        descricaoTabela: paraMaiusculo(preco.descricaoTabela || `COMISSÃO ${preco.comissao || "0"}%`),
        comissao: preco.comissao || "0",
        valor: preco.valor || "0,00"
      }));
    }

    produto.tabelas = Array.isArray(produto.tabelas) ? produto.tabelas : [];

    produto.tabelas = produto.tabelas.map(tabela => ({
      nomeTabela: paraMaiusculo(tabela.nomeTabela || "TABELA PADRÃO"),
      tipoTabela: tabela.tipoTabela || "vendedor",
      descricaoTabela: paraMaiusculo(tabela.descricaoTabela || `COMISSÃO ${tabela.comissao || "0"}%`),
      comissao: tabela.comissao || "0",
      valor: tabela.valor || "0,00"
    }));

    if (!categorias.includes(produto.categoria)) {
      categorias.push(produto.categoria);
    }

    return produto;
  });

  categorias = [...new Set(categorias)].sort();

  if (salvar) {
    salvarFirebase();
  }
}

/* ================= HORA ================= */

function atualizarHora() {
  const agora = new Date();

  document.getElementById("dataAtual").textContent = agora.toLocaleDateString("pt-BR");
  document.getElementById("horaAtual").textContent = agora.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

setInterval(atualizarHora, 1000);
atualizarHora();

/* ================= EMPRESA ================= */

function atualizarEmpresaTela() {
  document.getElementById("empresaNomeTopo").textContent = paraMaiusculo(empresa.nome || "REI DA MUSSARELA");

  const logo = document.getElementById("empresaLogoTopo");

  if (empresa.logo) {
    logo.src = empresa.logo;
    logo.style.display = "block";
  } else {
    logo.style.display = "none";
  }
}

function abrirModalEmpresa() {
  if (!isAdmin()) return;

  document.getElementById("empresaNome").value = empresa.nome || "";
  document.getElementById("empresaCnpj").value = empresa.cnpj || "";
  document.getElementById("empresaTelefone").value = empresa.telefone || "";

  document.getElementById("modalEmpresa").classList.add("ativo");
  fecharMenuMobileDepoisClique();
}

function fecharModalEmpresa() {
  document.getElementById("modalEmpresa").classList.remove("ativo");
}

async function salvarEmpresa() {
  if (!isAdmin()) return;

  empresa.nome = paraMaiusculo(document.getElementById("empresaNome").value || "REI DA MUSSARELA");
  empresa.cnpj = paraMaiusculo(document.getElementById("empresaCnpj").value);
  empresa.telefone = paraMaiusculo(document.getElementById("empresaTelefone").value);

  const arquivoLogo = document.getElementById("empresaLogo").files[0];

  if (arquivoLogo) {
    const reader = new FileReader();

    reader.onload = async e => {
      empresa.logo = e.target.result;

      await salvarFirebase();
      atualizarEmpresaTela();
      fecharModalEmpresa();
    };

    reader.readAsDataURL(arquivoLogo);
  } else {
    await salvarFirebase();
    atualizarEmpresaTela();
    fecharModalEmpresa();
  }
}

/* ================= CATEGORIAS ================= */

function abrirModalCategoria() {
  if (!isAdmin()) return;

  renderizarCategorias();
  document.getElementById("modalCategoria").classList.add("ativo");
  fecharMenuMobileDepoisClique();
}

function fecharModalCategoria() {
  document.getElementById("modalCategoria").classList.remove("ativo");
}

async function salvarCategoria() {
  if (!isAdmin()) return;

  const nome = paraMaiusculo(document.getElementById("novaCategoria").value);

  if (!nome) {
    alert("DIGITE O NOME DA CATEGORIA.");
    return;
  }

  if (categorias.includes(nome)) {
    alert("ESSA CATEGORIA JÁ EXISTE.");
    return;
  }

  categorias.push(nome);
  categorias.sort();

  document.getElementById("novaCategoria").value = "";

  await salvarFirebase();
  renderizarCategorias();
  atualizarSelectCategorias();
  renderizarCatalogo();
}

async function excluirCategoria(nome) {
  if (!isAdmin()) return;

  const emUso = produtos.some(produto => produto.categoria === nome);

  if (emUso) {
    alert("NÃO É POSSÍVEL EXCLUIR. EXISTEM PRODUTOS USANDO ESSA CATEGORIA.");
    return;
  }

  if (!confirm(`DESEJA EXCLUIR A CATEGORIA "${nome}"?`)) return;

  categorias = categorias.filter(categoria => categoria !== nome);

  await salvarFirebase();
  renderizarCategorias();
  atualizarSelectCategorias();
  renderizarCatalogo();
}

function renderizarCategorias() {
  const lista = document.getElementById("listaCategorias");

  if (categorias.length === 0) {
    lista.innerHTML = `<div class="vazio">NENHUMA CATEGORIA CADASTRADA.</div>`;
    return;
  }

  lista.innerHTML = categorias.map(categoria => `
    <div class="categoria-item">
      <strong>${categoria}</strong>
      <button onclick="excluirCategoria('${categoria.replace(/'/g, "\\'")}')">EXCLUIR</button>
    </div>
  `).join("");
}

function atualizarSelectCategorias() {
  const select = document.getElementById("produtoCategoria");
  const filtro = document.getElementById("filtroCategoria");

  if (!select || !filtro) return;

  const valorProduto = select.value;
  const valorFiltro = filtro.value;

  select.innerHTML = `<option value="">SELECIONE</option>`;
  filtro.innerHTML = `<option value="todos">TODAS CATEGORIAS</option>`;

  categorias.forEach(categoria => {
    select.innerHTML += `<option value="${categoria}">${categoria}</option>`;
    filtro.innerHTML += `<option value="${categoria}">${categoria}</option>`;
  });

  if (categorias.includes(valorProduto)) select.value = valorProduto;
  if (categorias.includes(valorFiltro)) filtro.value = valorFiltro;
}

/* ================= TABELAS ================= */

function abrirModalTabelas() {
  if (!isAdmin()) return;

  limparFormularioTabela();
  renderizarTabelasComerciais();

  document.getElementById("modalTabelas").classList.add("ativo");
  fecharMenuMobileDepoisClique();
}

function fecharModalTabelas() {
  document.getElementById("modalTabelas").classList.remove("ativo");
}

function limparFormularioTabela() {
  document.getElementById("tabelaEditandoId").value = "";
  document.getElementById("tabelaNomeAntigo").value = "";
  document.getElementById("novaTabelaNome").value = "";
  document.getElementById("novaTabelaTipo").value = "vendedor";
}

async function salvarTabelaComercial() {
  if (!isAdmin()) return;

  const idEditando = document.getElementById("tabelaEditandoId").value;
  const nomeAntigo = document.getElementById("tabelaNomeAntigo").value;
  const nome = paraMaiusculo(document.getElementById("novaTabelaNome").value);
  const tipo = document.getElementById("novaTabelaTipo").value;

  if (!nome) {
    alert("DIGITE O NOME DA TABELA.");
    return;
  }

  const existe = tabelasComerciais.some(tabela =>
    tabela.nome === nome && String(tabela.id) !== String(idEditando)
  );

  if (existe) {
    alert("ESSA TABELA JÁ EXISTE.");
    return;
  }

  if (idEditando) {
    tabelasComerciais = tabelasComerciais.map(tabela => {
      if (String(tabela.id) === String(idEditando)) {
        return { ...tabela, nome, tipo };
      }

      return tabela;
    });

    produtos = produtos.map(produto => {
      produto.tabelas = (produto.tabelas || []).map(tabela => {
        if (paraMaiusculo(tabela.nomeTabela) === paraMaiusculo(nomeAntigo)) {
          return {
            ...tabela,
            nomeTabela: nome,
            tipoTabela: tipo
          };
        }

        return tabela;
      });

      return produto;
    });

    await atualizarUsuariosComTabela(nomeAntigo, nome);
  } else {
    tabelasComerciais.push({
      id: Date.now(),
      nome,
      tipo
    });
  }

  await salvarFirebase();

  limparFormularioTabela();
  renderizarTabelasComerciais();
  renderizarCatalogo();

  alert("TABELA SALVA COM SUCESSO.");
}

function editarTabelaComercial(id) {
  const tabela = tabelasComerciais.find(item => String(item.id) === String(id));

  if (!tabela) return;

  document.getElementById("tabelaEditandoId").value = tabela.id;
  document.getElementById("tabelaNomeAntigo").value = tabela.nome;
  document.getElementById("novaTabelaNome").value = tabela.nome;
  document.getElementById("novaTabelaTipo").value = tabela.tipo || "vendedor";
}

async function excluirTabelaComercial(id) {
  if (!isAdmin()) return;

  const tabela = tabelasComerciais.find(item => String(item.id) === String(id));

  if (!tabela) return;

  const emUso = produtos.some(produto =>
    (produto.tabelas || []).some(t => paraMaiusculo(t.nomeTabela) === paraMaiusculo(tabela.nome))
  );

  if (emUso) {
    alert("ESSA TABELA ESTÁ SENDO USADA EM PRODUTOS. EDITE OU REMOVA DOS PRODUTOS PRIMEIRO.");
    return;
  }

  if (!confirm("DESEJA EXCLUIR ESSA TABELA?")) return;

  tabelasComerciais = tabelasComerciais.filter(item => String(item.id) !== String(id));

  await salvarFirebase();
  renderizarTabelasComerciais();
}

function renderizarTabelasComerciais() {
  const lista = document.getElementById("listaTabelasComerciais");

  if (tabelasComerciais.length === 0) {
    lista.innerHTML = `<div class="vazio">NENHUMA TABELA CADASTRADA.</div>`;
    return;
  }

  lista.innerHTML = tabelasComerciais.map(tabela => `
    <div class="usuario-item">
      <div>
        <strong>${tabela.nome}</strong><br>
        <small>${formatarTipo(tabela.tipo)}</small>
      </div>

      <div class="usuario-acoes">
        <button class="btn-editar-user" onclick="editarTabelaComercial(${tabela.id})">EDITAR</button>
        <button class="btn-excluir-user" onclick="excluirTabelaComercial(${tabela.id})">EXCLUIR</button>
      </div>
    </div>
  `).join("");
}

async function atualizarUsuariosComTabela(nomeAntigo, nomeNovo) {
  const snap = await getDocs(collection(db, "usuarios"));

  for (const item of snap.docs) {
    const usuario = item.data();

    if (paraMaiusculo(usuario.tabelaVinculada) === paraMaiusculo(nomeAntigo)) {
      await setDoc(doc(db, "usuarios", item.id), {
        tabelaVinculada: nomeNovo
      }, { merge: true });
    }
  }
}

/* ================= PRODUTOS ================= */

function abrirModalProduto(id = null) {
  if (!isAdmin()) return;

  limparFormularioProduto();
  atualizarSelectCategorias();

  if (id) {
    const produto = produtos.find(item => item.id === id);

    if (!produto) return;

    document.getElementById("produtoId").value = produto.id;
    document.getElementById("produtoCodigo").value = produto.codigo;
    document.getElementById("produtoNome").value = produto.nome;
    document.getElementById("produtoCategoria").value = produto.categoria;
    document.getElementById("produtoAtivo").value = produto.ativo ? "true" : "false";
    document.getElementById("produtoDescricao").value = produto.descricao || "";

    produto.tabelas.forEach(tabela => {
      adicionarTabela(
        tabela.nomeTabela,
        tabela.tipoTabela,
        tabela.descricaoTabela,
        tabela.comissao,
        tabela.valor
      );
    });
  } else {
    document.getElementById("produtoCodigo").value = gerarCodigo();
    document.getElementById("produtoAtivo").value = "true";

    adicionarTabela("TABELA PADRÃO", "vendedor", "COMISSÃO 0,5%", "0.5", "");
  }

  document.getElementById("modalProduto").classList.add("ativo");
  fecharMenuMobileDepoisClique();
}

function fecharModalProduto() {
  document.getElementById("modalProduto").classList.remove("ativo");
}

function limparFormularioProduto() {
  document.getElementById("produtoId").value = "";
  document.getElementById("produtoCodigo").value = gerarCodigo();
  document.getElementById("produtoNome").value = "";
  document.getElementById("produtoCategoria").value = "";
  document.getElementById("produtoAtivo").value = "true";
  document.getElementById("produtoDescricao").value = "";
  document.getElementById("produtoImagem").value = "";
  document.getElementById("listaTabelas").innerHTML = "";
}

function adicionarTabela(
  nomeTabela = "",
  tipoTabela = "vendedor",
  descricaoTabela = "",
  comissao = "0.5",
  valor = ""
) {
  const lista = document.getElementById("listaTabelas");

  const linha = document.createElement("div");
  linha.className = "linha-tabela item-tabela";

  const opcoesTabelas = tabelasComerciais.length > 0
    ? tabelasComerciais.map(tabela => `
      <option value="${tabela.nome}" ${paraMaiusculo(nomeTabela) === tabela.nome ? "selected" : ""}>
        ${tabela.nome}
      </option>
    `).join("")
    : `<option value="${paraMaiusculo(nomeTabela || "TABELA PADRÃO")}">${paraMaiusculo(nomeTabela || "TABELA PADRÃO")}</option>`;

  linha.innerHTML = `
    <select class="tabela-nome">
      ${opcoesTabelas}
    </select>

    <select class="tabela-tipo">
      <option value="vendedor" ${tipoTabela === "vendedor" ? "selected" : ""}>VENDEDOR</option>
      <option value="representante" ${tipoTabela === "representante" ? "selected" : ""}>REPRESENTANTE</option>
      <option value="representante_comfro" ${tipoTabela === "representante_comfro" ? "selected" : ""}>REPRESENTANTE COMFRO</option>
    </select>

    <input class="tabela-descricao" placeholder="EX: COMISSÃO 0,5%" value="${paraMaiusculo(descricaoTabela)}">
    <input class="tabela-comissao" placeholder="0.5" value="${comissao}">
    <input class="tabela-valor" placeholder="39,49" value="${valor}">

    <button onclick="removerTabela(this)" type="button">EXCLUIR</button>
  `;

  lista.appendChild(linha);
}

function removerTabela(botao) {
  botao.parentElement.remove();

  if (document.querySelectorAll(".item-tabela").length === 0) {
    adicionarTabela("TABELA PADRÃO", "vendedor", "COMISSÃO 0,5%", "0.5", "");
  }
}

function capturarTabelas() {
  const linhas = document.querySelectorAll(".item-tabela");
  const tabelas = [];

  linhas.forEach(linha => {
    const nomeTabela = paraMaiusculo(linha.querySelector(".tabela-nome").value);
    const tipoTabela = linha.querySelector(".tabela-tipo").value;
    const descricaoTabela = paraMaiusculo(linha.querySelector(".tabela-descricao").value);
    const comissao = linha.querySelector(".tabela-comissao").value.trim();
    const valor = linha.querySelector(".tabela-valor").value.trim();

    if (nomeTabela && valor) {
      tabelas.push({
        nomeTabela,
        tipoTabela,
        descricaoTabela,
        comissao,
        valor
      });
    }
  });

  return tabelas;
}

async function salvarProduto() {
  if (!isAdmin()) return;

  const id = document.getElementById("produtoId").value;
  const codigo = document.getElementById("produtoCodigo").value;
  const nome = paraMaiusculo(document.getElementById("produtoNome").value);
  const categoria = paraMaiusculo(document.getElementById("produtoCategoria").value);
  const ativo = document.getElementById("produtoAtivo").value === "true";
  const descricao = paraMaiusculo(document.getElementById("produtoDescricao").value);
  const imagemInput = document.getElementById("produtoImagem");
  const tabelas = capturarTabelas();

  if (!nome || !categoria) {
    alert("PREENCHA NOME E CATEGORIA.");
    return;
  }

  if (tabelas.length === 0) {
    alert("ADICIONE PELO MENOS UMA TABELA COM PREÇO.");
    return;
  }

  const arquivoImagem = imagemInput.files[0];

  if (arquivoImagem) {
    const reader = new FileReader();

    reader.onload = async e => {
      await salvarProdutoFinal(id, codigo, nome, categoria, ativo, descricao, tabelas, e.target.result);
    };

    reader.readAsDataURL(arquivoImagem);
  } else {
    const produtoAtual = produtos.find(item => item.id == id);
    const imagemAntiga = produtoAtual ? produtoAtual.imagem : "";

    await salvarProdutoFinal(id, codigo, nome, categoria, ativo, descricao, tabelas, imagemAntiga);
  }
}

async function salvarProdutoFinal(id, codigo, nome, categoria, ativo, descricao, tabelas, imagem) {
  if (id) {
    produtos = produtos.map(produto => {
      if (produto.id == id) {
        return {
          ...produto,
          codigo,
          nome,
          categoria,
          ativo,
          descricao,
          tabelas,
          imagem,
          atualizadoEm: new Date().toISOString()
        };
      }

      return produto;
    });
  } else {
    produtos.push({
      id: Date.now(),
      codigo,
      nome,
      categoria,
      ativo,
      descricao,
      tabelas,
      imagem,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    });
  }

  await salvarFirebase();

  fecharModalProduto();
  renderizarCatalogo();
}

async function excluirProduto(id) {
  if (!isAdmin()) return;

  if (!confirm("DESEJA EXCLUIR ESTE PRODUTO?")) return;

  produtos = produtos.filter(produto => produto.id !== id);

  await salvarFirebase();
  renderizarCatalogo();
}

async function alternarStatusProduto(id) {
  if (!isAdmin()) return;

  produtos = produtos.map(produto => {
    if (produto.id === id) {
      return {
        ...produto,
        ativo: !produto.ativo,
        atualizadoEm: new Date().toISOString()
      };
    }

    return produto;
  });

  await salvarFirebase();
  renderizarCatalogo();
}

/* ================= CATÁLOGO ================= */

function filtrarTabelasDoUsuario(produto) {
  if (isAdmin()) {
    return produto.tabelas || [];
  }

  const tabela = tabelaUsuario();
  const tipo = tipoUsuario();

  return (produto.tabelas || []).filter(item => {
    const nomeTabela = paraMaiusculo(item.nomeTabela);
    const tipoTabela = String(item.tipoTabela || "").trim().toLowerCase();

    return nomeTabela === tabela || tipoTabela === tipo;
  });
}

function renderizarCatalogo() {
  normalizarDados(false);
  atualizarSelectCategorias();
  atualizarDashboard();

  const tela = document.getElementById("catalogoProdutos");
  const pesquisa = document.getElementById("pesquisaProduto").value.toLowerCase();
  const categoriaFiltro = document.getElementById("filtroCategoria").value;

  let lista = produtos;

  if (!isAdmin()) {
    lista = lista.filter(produto => produto.ativo);
  }

  if (pesquisa) {
    lista = lista.filter(produto =>
      produto.nome.toLowerCase().includes(pesquisa) ||
      produto.categoria.toLowerCase().includes(pesquisa)
    );
  }

  if (categoriaFiltro !== "todos") {
    lista = lista.filter(produto => produto.categoria === categoriaFiltro);
  }

  lista = lista.filter(produto => filtrarTabelasDoUsuario(produto).length > 0);

  if (lista.length === 0) {
    tela.innerHTML = `<div class="vazio">NENHUM PRODUTO ENCONTRADO.</div>`;
    return;
  }

  tela.innerHTML = lista.map(produto => {
    const tabelasVisiveis = filtrarTabelasDoUsuario(produto);

    return `
      <div class="card-produto ${produto.ativo ? "" : "inativo"}" onclick="abrirPopupProduto(${produto.id})">
        <img src="${produto.imagem || imagemPadrao()}" alt="${produto.nome}">

        <div class="info-produto">
          <span class="categoria-produto">${produto.categoria}</span>

          ${isAdmin() ? `
            <span class="status-produto ${produto.ativo ? "status-ativo" : "status-inativo"}">
              ${produto.ativo ? "ATIVO" : "INATIVO"}
            </span>
          ` : ""}

          <h3>${produto.nome}</h3>
          <p>${produto.descricao || "SEM DESCRIÇÃO"}</p>

          <div class="lista-tabelas-produto">
            ${tabelasVisiveis.map(tabela => `
              <div class="tabela-item-catalogo">
                <div class="tabela-info-esquerda">
                  <strong>${tabela.descricaoTabela || `COMISSÃO ${tabela.comissao}%`}</strong>
                </div>

                <span class="preco-verde">
                  R$ ${formatarValor(tabela.valor)}
                </span>
              </div>
            `).join("")}
          </div>
        </div>

        ${isAdmin() ? `
          <div class="acoes-produto">
            <button class="editar" onclick="event.stopPropagation(); abrirModalProduto(${produto.id})">EDITAR</button>

            <button class="${produto.ativo ? "desativar" : "ativar"}" onclick="event.stopPropagation(); alternarStatusProduto(${produto.id})">
              ${produto.ativo ? "DESATIVAR" : "ATIVAR"}
            </button>

            <button class="excluir" onclick="event.stopPropagation(); excluirProduto(${produto.id})">EXCLUIR</button>
          </div>
        ` : ""}
      </div>
    `;
  }).join("");
}

function atualizarDashboard() {
  const ativos = produtos.filter(produto => produto.ativo).length;
  const totalTabelas = produtos.reduce((total, produto) => total + (produto.tabelas ? produto.tabelas.length : 0), 0);

  document.getElementById("totalProdutos").textContent = produtos.length;
  document.getElementById("totalAtivos").textContent = ativos;
  document.getElementById("totalTabelas").textContent = totalTabelas;
}

/* ================= POPUP PRODUTO ================= */

function abrirPopupProduto(id) {
  const produto = produtos.find(item => item.id === id);

  if (!produto) return;

  const precos = filtrarTabelasDoUsuario(produto);

  document.getElementById("popupProdutoTitulo").textContent = produto.nome;
  document.getElementById("popupProdutoImagem").src = produto.imagem || imagemPadrao();
  document.getElementById("popupProdutoDescricao").textContent = produto.descricao || "SEM DESCRIÇÃO";

  document.getElementById("popupProdutoPrecos").innerHTML = precos.map(tabela => `
    <div class="popup-preco-linha">
      <strong>${tabela.descricaoTabela || `COMISSÃO ${tabela.comissao}%`}</strong>
      <span>R$ ${formatarValor(tabela.valor)}</span>
    </div>
  `).join("");

  document.getElementById("popupProduto").classList.add("ativo");
}

function fecharPopupProduto() {
  document.getElementById("popupProduto").classList.remove("ativo");
}

/* ================= USUÁRIOS ================= */

function abrirModalUsuarios() {
  if (!isAdmin()) return;

  limparFormularioUsuario();
  listarUsuarios();

  document.getElementById("modalUsuarios").classList.add("ativo");
  fecharMenuMobileDepoisClique();
}

function fecharModalUsuarios() {
  document.getElementById("modalUsuarios").classList.remove("ativo");
}

function limparFormularioUsuario() {
  document.getElementById("usuarioEditandoId").value = "";
  document.getElementById("usuarioNovoNome").value = "";
  document.getElementById("usuarioNovoEmail").value = "";
  document.getElementById("usuarioNovoSenha").value = "";
  document.getElementById("usuarioNovoPermissao").value = "vendedor";
  document.getElementById("usuarioNovaTabela").value = "";
}

async function criarUsuario() {
  if (!isAdmin()) return;

  const idEditando = document.getElementById("usuarioEditandoId").value;
  const nome = paraMaiusculo(document.getElementById("usuarioNovoNome").value);
  const email = document.getElementById("usuarioNovoEmail").value.trim();
  const senha = document.getElementById("usuarioNovoSenha").value.trim();
  const permissao = document.getElementById("usuarioNovoPermissao").value;
  const tabelaVinculada = paraMaiusculo(document.getElementById("usuarioNovaTabela").value);

  if (!nome || !email) {
    alert("PREENCHA NOME E EMAIL.");
    return;
  }

  if (permissao !== "admin" && !tabelaVinculada) {
    alert("INFORME A TABELA VINCULADA.");
    return;
  }

  try {
    if (idEditando) {
      await setDoc(doc(db, "usuarios", idEditando), {
        nome,
        email,
        permissao,
        tabelaVinculada,
        atualizadoEm: new Date().toISOString()
      }, { merge: true });

      alert("USUÁRIO ATUALIZADO COM SUCESSO.");
    } else {
      if (!senha) {
        alert("INFORME A SENHA DO NOVO USUÁRIO.");
        return;
      }

      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, senha);

      await setDoc(doc(db, "usuarios", cred.user.uid), {
        nome,
        email,
        permissao,
        tabelaVinculada,
        criadoEm: new Date().toISOString()
      });

      await signOut(secondaryAuth);

      alert("USUÁRIO CRIADO COM SUCESSO.");
    }

    limparFormularioUsuario();
    listarUsuarios();
  } catch (erro) {
    alert("ERRO AO SALVAR USUÁRIO: " + erro.message);
  }
}

async function listarUsuarios() {
  const lista = document.getElementById("listaUsuarios");

  lista.innerHTML = "CARREGANDO...";

  const snap = await getDocs(collection(db, "usuarios"));

  let html = "";

  snap.forEach(item => {
    const usuario = item.data();

    html += `
      <div class="usuario-item">
        <div>
          <strong>${paraMaiusculo(usuario.nome || "SEM NOME")}</strong><br>
          <small>${usuario.email || ""}</small><br>
          <small>${formatarTipo(usuario.permissao || "")}</small><br>
          <small>${paraMaiusculo(usuario.tabelaVinculada || "SEM TABELA")}</small>
        </div>

        <div class="usuario-acoes">
          <button class="btn-editar-user" onclick="editarUsuario('${item.id}')">
            EDITAR
          </button>
        </div>
      </div>
    `;
  });

  lista.innerHTML = html || "NENHUM USUÁRIO CADASTRADO.";
}

async function editarUsuario(id) {
  const snap = await getDoc(doc(db, "usuarios", id));

  if (!snap.exists()) {
    alert("USUÁRIO NÃO ENCONTRADO.");
    return;
  }

  const usuario = snap.data();

  document.getElementById("usuarioEditandoId").value = id;
  document.getElementById("usuarioNovoNome").value = paraMaiusculo(usuario.nome || "");
  document.getElementById("usuarioNovoEmail").value = usuario.email || "";
  document.getElementById("usuarioNovoSenha").value = "";
  document.getElementById("usuarioNovoPermissao").value = usuario.permissao || "vendedor";
  document.getElementById("usuarioNovaTabela").value = paraMaiusculo(usuario.tabelaVinculada || "");
}

/* ================= PDF PREMIUM OTIMIZADO ================= */

function abrirPopupPDF() {
  document.getElementById("popupPDF").classList.add("ativo");
  fecharMenuMobileDepoisClique();
}

function fecharPopupPDF() {
  document.getElementById("popupPDF").classList.remove("ativo");
}

function agruparPorCategoria(lista) {
  return lista.reduce((grupos, produto) => {

    const categoria = produto.categoria || "SEM CATEGORIA";

    if (!grupos[categoria]) {
      grupos[categoria] = [];
    }

    grupos[categoria].push(produto);

    return grupos;

  }, {});
}

async function gerarPDF() {

  fecharPopupPDF();

  const produtosVisiveis = produtos.filter(produto =>
    isAdmin() || produto.ativo
  );

  if (produtosVisiveis.length === 0) {
    alert("NENHUM PRODUTO DISPONÍVEL.");
    return;
  }

  const area = document.getElementById("areaPDF");

  area.innerHTML = "";

  const grupos = agruparPorCategoria(produtosVisiveis);

  const paginas = [];

  let numeroPagina = 1;

  /* ================= CRIAR PÁGINA ================= */

  function criarPagina() {

    const pagina = document.createElement("div");

    pagina.className = "pagina-pdf";

    pagina.innerHTML = `
      <div class="cabecalho-pdf">

        ${empresa.logo ? `
          <img class="logo-pdf" src="${empresa.logo}">
        ` : ""}

        <div>
          <h1>${paraMaiusculo(empresa.nome || "REI DA MUSSARELA")}</h1>

          <p>CATÁLOGO COMERCIAL</p>
        </div>

      </div>

      <div class="conteudo-pdf"></div>

      <div class="rodape-pdf">
        <span>${empresa.telefone || "CATÁLOGO DIGITAL"}</span>

        <span>${numeroPagina}/${0}</span>
      </div>
    `;

    area.appendChild(pagina);

    paginas.push(pagina);

    numeroPagina++;

    return pagina;
  }

  let paginaAtual = criarPagina();

  let conteudoAtual = paginaAtual.querySelector(".conteudo-pdf");

  function passouLimite() {
    return conteudoAtual.scrollHeight > 940;
  }

  /* ================= CATEGORIAS ================= */

  Object.keys(grupos)
    .sort()
    .forEach(categoria => {

      let tituloCategoria = document.createElement("div");

      tituloCategoria.className = "categoria-pdf";

      tituloCategoria.textContent = categoria;

      conteudoAtual.appendChild(tituloCategoria);

      let grid = document.createElement("div");

      grid.className = "grid-pdf";

      conteudoAtual.appendChild(grid);

      grupos[categoria].forEach(produto => {

        const card = document.createElement("div");

        card.className = "produto-pdf";

        card.innerHTML = `
          <img src="${produto.imagem || imagemPadrao()}">

          <h3>${produto.nome}</h3>

          <p>${produto.descricao || "SEM DESCRIÇÃO"}</p>

          <div class="sem-preco">
            CONSULTE VALORES
          </div>
        `;

        grid.appendChild(card);

        /* ================= NOVA PÁGINA ================= */

        if (passouLimite()) {

          card.remove();

          if (grid.children.length === 0) {
            grid.remove();
            tituloCategoria.remove();
          }

          paginaAtual = criarPagina();

          conteudoAtual = paginaAtual.querySelector(".conteudo-pdf");

          tituloCategoria = document.createElement("div");

          tituloCategoria.className = "categoria-pdf";

          tituloCategoria.textContent = categoria;

          conteudoAtual.appendChild(tituloCategoria);

          grid = document.createElement("div");

          grid.className = "grid-pdf";

          conteudoAtual.appendChild(grid);

          grid.appendChild(card);
        }

      });

    });

  /* ================= NUMERAÇÃO ================= */

  paginas.forEach((pagina, index) => {

    const rodape = pagina.querySelector(".rodape-pdf span:last-child");

    rodape.textContent = `${index + 1}/${paginas.length}`;

  });

  /* ================= GERAR PDF ================= */

  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF("p", "mm", "a4");

  for (let i = 0; i < paginas.length; i++) {

    const canvas = await html2canvas(paginas[i], {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff"
    });

    const imgData = canvas.toDataURL("image/jpeg", 1);

    if (i > 0) {
      pdf.addPage();
    }

    pdf.addImage(
      imgData,
      "JPEG",
      0,
      0,
      210,
      297
    );
  }

  pdf.save("CATALOGO-PREMIUM.pdf");
}
/* ================= XLS ================= */

function lerArquivoXLS(arquivo, callback) {
  const reader = new FileReader();

  reader.onload = e => {
    const dados = new Uint8Array(e.target.result);
    const workbook = XLSX.read(dados, { type: "array" });
    const aba = workbook.SheetNames[0];
    const planilha = workbook.Sheets[aba];

    const linhas = XLSX.utils.sheet_to_json(planilha, {
      defval: ""
    });

    callback(linhas);
  };

  reader.readAsArrayBuffer(arquivo);
}

function encontrarProdutoPorCodigoOuNome(codigo, nome) {
  const codigoBusca = paraMaiusculo(codigo);
  const nomeBusca = paraMaiusculo(nome);

  return produtos.find(produto =>
    paraMaiusculo(produto.codigo) === codigoBusca ||
    paraMaiusculo(produto.nome) === nomeBusca
  );
}

function baixarPlanilhaProdutos() {
  if (!isAdmin()) return;

  const linhas = [];

  produtos.forEach(produto => {
    (produto.tabelas || []).forEach(tabela => {
      linhas.push({
        CODIGO: produto.codigo || "",
        PRODUTO: produto.nome || "",
        CATEGORIA: produto.categoria || "",
        DESCRICAO: produto.descricao || "",
        ATIVO: produto.ativo ? "SIM" : "NÃO",
        TABELA: tabela.nomeTabela || "",
        TIPO: tabela.tipoTabela || "vendedor",
        COMISSAO: tabela.descricaoTabela || "",
        COMISSAO_VALOR: tabela.comissao || "",
        VALOR: tabela.valor || ""
      });
    });
  });

  const planilha = XLSX.utils.json_to_sheet(linhas);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, planilha, "PRODUTOS");
  XLSX.writeFile(workbook, "produtos-sistema.xlsx");
}

async function importarAtualizacaoProdutos(evento) {
  if (!isAdmin()) return;

  const arquivo = evento.target.files[0];

  if (!arquivo) return;

  lerArquivoXLS(arquivo, async linhas => {
    let cadastrados = 0;
    let atualizados = 0;

    linhas.forEach(linha => {
      const codigo = paraMaiusculo(linha.CODIGO || linha.Código || linha.codigo || "");
      const nome = paraMaiusculo(linha.PRODUTO || linha.Produto || linha.produto || linha.NOME || "");
      const categoria = paraMaiusculo(linha.CATEGORIA || linha.Categoria || linha.categoria || "SEM CATEGORIA");
      const descricao = paraMaiusculo(linha.DESCRICAO || linha.DESCRIÇÃO || linha.Descricao || linha.descricao || "");
      const ativoTexto = paraMaiusculo(linha.ATIVO || linha.Status || linha.status || "SIM");

      const tabelaNome = paraMaiusculo(linha.TABELA || linha.Tabela || linha.tabela || "TABELA PADRÃO");
      const tipoTabela = String(linha.TIPO || linha.Tipo || linha.tipo || "vendedor").toLowerCase();
      const descricaoComissao = paraMaiusculo(linha.COMISSAO || linha.COMISSÃO || linha.Comissao || linha.comissao || "");
      const comissao = normalizarValorXLS(linha.COMISSAO_VALOR || linha.comissao_valor || "");
      const valor = normalizarValorXLS(linha.VALOR || linha.PRECO || linha.PREÇO || linha.valor || linha.preco || "");

      if (!nome || !valor) return;

      if (!categorias.includes(categoria)) {
        categorias.push(categoria);
      }

      let produto = encontrarProdutoPorCodigoOuNome(codigo, nome);

      const novaTabela = {
        nomeTabela: tabelaNome,
        tipoTabela,
        descricaoTabela: descricaoComissao || `COMISSÃO ${comissao}%`,
        comissao: comissao || "0",
        valor
      };

      if (produto) {
        produto.codigo = codigo || produto.codigo;
        produto.nome = nome;
        produto.categoria = categoria;
        produto.descricao = descricao;
        produto.ativo = ativoTexto !== "NÃO" && ativoTexto !== "NAO" && ativoTexto !== "INATIVO";
        produto.tabelas = produto.tabelas || [];

        const tabelaExistente = produto.tabelas.find(item =>
          paraMaiusculo(item.nomeTabela) === tabelaNome &&
          paraMaiusculo(item.descricaoTabela) === paraMaiusculo(novaTabela.descricaoTabela)
        );

        if (tabelaExistente) {
          tabelaExistente.tipoTabela = novaTabela.tipoTabela;
          tabelaExistente.descricaoTabela = novaTabela.descricaoTabela;
          tabelaExistente.comissao = novaTabela.comissao;
          tabelaExistente.valor = novaTabela.valor;
        } else {
          produto.tabelas.push(novaTabela);
        }

        atualizados++;
      } else {
        produtos.push({
          id: Date.now() + Math.floor(Math.random() * 99999),
          codigo: codigo || gerarCodigo(),
          nome,
          categoria,
          descricao,
          ativo: ativoTexto !== "NÃO" && ativoTexto !== "NAO" && ativoTexto !== "INATIVO",
          imagem: "",
          tabelas: [novaTabela],
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString()
        });

        cadastrados++;
      }
    });

    categorias = [...new Set(categorias.map(c => paraMaiusculo(c)))].sort();

    await salvarFirebase();

    atualizarSelectCategorias();
    renderizarCatalogo();

    alert(`${cadastrados} PRODUTOS CRIADOS E ${atualizados} PRODUTOS ATUALIZADOS.`);

    evento.target.value = "";
  });
}

/* ================= EVENTOS ================= */

document.addEventListener("DOMContentLoaded", () => {
  const arquivoAtualizarProdutos = document.getElementById("arquivoAtualizarProdutos");

  if (arquivoAtualizarProdutos) {
    arquivoAtualizarProdutos.addEventListener("change", importarAtualizacaoProdutos);
  }
});

/* ================= EXPORTS ================= */

window.toggleMenuMobile = toggleMenuMobile;

window.fazerLogin = fazerLogin;
window.logoutSistema = logoutSistema;

window.abrirModalProduto = abrirModalProduto;
window.fecharModalProduto = fecharModalProduto;
window.salvarProduto = salvarProduto;
window.excluirProduto = excluirProduto;
window.alternarStatusProduto = alternarStatusProduto;

window.adicionarTabela = adicionarTabela;
window.removerTabela = removerTabela;

window.abrirModalCategoria = abrirModalCategoria;
window.fecharModalCategoria = fecharModalCategoria;
window.salvarCategoria = salvarCategoria;
window.excluirCategoria = excluirCategoria;

window.abrirModalTabelas = abrirModalTabelas;
window.fecharModalTabelas = fecharModalTabelas;
window.salvarTabelaComercial = salvarTabelaComercial;
window.excluirTabelaComercial = excluirTabelaComercial;
window.editarTabelaComercial = editarTabelaComercial;
window.limparFormularioTabela = limparFormularioTabela;

window.abrirModalEmpresa = abrirModalEmpresa;
window.fecharModalEmpresa = fecharModalEmpresa;
window.salvarEmpresa = salvarEmpresa;

window.abrirModalUsuarios = abrirModalUsuarios;
window.fecharModalUsuarios = fecharModalUsuarios;
window.criarUsuario = criarUsuario;
window.editarUsuario = editarUsuario;

window.abrirPopupPDF = abrirPopupPDF;
window.fecharPopupPDF = fecharPopupPDF;
window.gerarPDF = gerarPDF;

window.abrirPopupProduto = abrirPopupProduto;
window.fecharPopupProduto = fecharPopupProduto;

window.baixarPlanilhaProdutos = baixarPlanilhaProdutos;
window.importarAtualizacaoProdutos = importarAtualizacaoProdutos;

window.renderizarCatalogo = renderizarCatalogo;