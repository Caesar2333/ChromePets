import { saveStoredPetAsset, stripRuntimePetConfig, toImportedPetIdentity } from "../pet/petRepository";
import type { PetConfig, PetIdentity, PetSettings } from "../pet/types";
import "./style.css";

interface FileSystemFileHandleLike {
  getFile: () => Promise<File>;
}

interface FileSystemDirectoryHandleLike {
  name?: string;
  getFileHandle: (name: string) => Promise<FileSystemFileHandleLike>;
}

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: (options?: { mode?: "read" }) => Promise<FileSystemDirectoryHandleLike>;
}

const MESSAGE_TYPES = {
  getGlobalState: "PET_GET_GLOBAL_STATE",
  updateGlobalState: "PET_UPDATE_GLOBAL_STATE"
} as const;

const chooseButton = document.querySelector<HTMLButtonElement>("#choose-folder");
const closeButton = document.querySelector<HTMLButtonElement>("#close-page");
const folderInput = document.querySelector<HTMLInputElement>("#folder-input");
const statusNode = document.querySelector<HTMLElement>("#status");

folderInput?.setAttribute("webkitdirectory", "");
folderInput?.setAttribute("directory", "");

chooseButton?.addEventListener("click", () => {
  void choosePetPackageFolder();
});

closeButton?.addEventListener("click", () => {
  window.close();
});

folderInput?.addEventListener("change", () => {
  void importFromFileList(folderInput.files);
});

async function choosePetPackageFolder(): Promise<void> {
  setStatus("Opening folder picker...");
  const showDirectoryPicker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
  if (!showDirectoryPicker) {
    folderInput?.click();
    return;
  }

  try {
    const directory = await showDirectoryPicker.call(window, { mode: "read" });
    const jsonFile = await (await directory.getFileHandle("pet.json")).getFile();
    const webpFile = await (await directory.getFileHandle("spritesheet.webp")).getFile();
    await importPetPackage(jsonFile, webpFile, directory.name);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      setStatus("Import cancelled.");
      return;
    }
    setError(error instanceof Error ? error.message : "Select a folder containing pet.json and spritesheet.webp.");
  }
}

async function importFromFileList(files: FileList | null): Promise<void> {
  if (!files) return;
  const fileArray = Array.from(files);
  const jsonFile = findPetPackageFile(fileArray, "pet.json");
  const webpFile = findPetPackageFile(fileArray, "spritesheet.webp");

  if (!jsonFile || !webpFile) {
    setError("Select a pet package folder containing pet.json and spritesheet.webp.");
    return;
  }

  await importPetPackage(jsonFile, webpFile, getPackageFolderName(fileArray));
}

async function importPetPackage(jsonFile: File, webpFile: File, sourceFolderName?: string): Promise<void> {
  try {
    setStatus("Reading pet package...");
    const config = JSON.parse(await jsonFile.text()) as PetConfig;
    if (!config.id) throw new Error("pet.json is missing id.");

    const settings = await getGlobalState();
    const spritesheetDataUrl = await readAsDataUrl(webpFile);
    const importedId = createUniqueImportedPetId(config.id, settings.importedPets, sourceFolderName);
    const asset = {
      id: importedId,
      config: stripRuntimePetConfig(config),
      spritesheetDataUrl
    };

    await saveStoredPetAsset(asset);
    const importedPet = toImportedPetIdentity(asset);
    const importedPets = [importedPet, ...settings.importedPets];

    await updateGlobalState({
      importedPets,
      activePet: importedPet,
      petId: importedPet.id,
      currentAnimationState: "idle"
    });

    setStatus(`Imported ${importedPet.displayName}. You can close this tab.`);
  } catch (error) {
    setError(error instanceof Error ? error.message : "Failed to import pet package.");
  } finally {
    if (folderInput) folderInput.value = "";
  }
}

async function getGlobalState(): Promise<PetSettings> {
  const response = await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.getGlobalState });
  return response.settings as PetSettings;
}

async function updateGlobalState(patch: Partial<PetSettings>): Promise<void> {
  await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.updateGlobalState, patch });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read spritesheet.webp."));
    reader.readAsDataURL(file);
  });
}

function createUniqueImportedPetId(configId: string, importedPets: PetIdentity[], sourceFolderName?: string): string {
  const base = slugify(sourceFolderName || configId || "imported-pet");
  const existingIds = new Set(importedPets.map((pet) => pet.id));
  if (!existingIds.has(base)) return base;

  let index = 2;
  while (existingIds.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `imported-pet-${Date.now().toString(36)}`;
}

function findPetPackageFile(files: File[], fileName: "pet.json" | "spritesheet.webp"): File | undefined {
  const exactRootMatch = files.find((file) => file.name.toLowerCase() === fileName);
  if (exactRootMatch) return exactRootMatch;

  return files.find((file) => {
    const relativePath = "webkitRelativePath" in file ? String(file.webkitRelativePath).replace(/\\/g, "/").toLowerCase() : "";
    return relativePath.endsWith(`/${fileName}`) || relativePath === fileName;
  });
}

function getPackageFolderName(files: File[]): string | undefined {
  const fileWithPath = files.find((file) => "webkitRelativePath" in file && String(file.webkitRelativePath).includes("/"));
  if (!fileWithPath || !("webkitRelativePath" in fileWithPath)) return undefined;
  return String(fileWithPath.webkitRelativePath).split(/[\\/]/)[0];
}

function setStatus(message: string): void {
  if (!statusNode) return;
  statusNode.className = "status";
  statusNode.textContent = message;
}

function setError(message: string): void {
  if (!statusNode) return;
  statusNode.className = "status error";
  statusNode.textContent = message;
}
