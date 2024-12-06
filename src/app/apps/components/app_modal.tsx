import { useState, useEffect, useRef } from "react";

//Worker
import { BiArrowBack } from "react-icons/bi";
import fetchApps, {
  appData,
  AuthorObject,
  fetchAuthor,
  getResource,
} from "../../resources/api/fetchApps";

//AHQ Store Installer
import { install_app } from "../../resources/core";
import {
  isInstalled,
  unInstall,
} from "../../resources/api/updateInstallWorker";
import { ApplicationPopup } from "../../resources/components/popup";
import { invoke } from "@tauri-apps/api/core";
import { IoCheckmarkCircle, IoWarning } from "react-icons/io5";
import { FaAndroid, FaLinux } from "react-icons/fa6";
import { worker } from "../../resources/core/installer";

import win from "./windows.svg";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

// Icon
import pkg from "./package.png";
import { AHQStoreApplication } from "src-ahqstore-types/pkg/ahqstore_types";
import { getArch } from "@/app/resources/api/os";

import Markdown from 'react-markdown'

interface AppDataPropsModal {
  shown: boolean;
  change: Function;
  dark: Boolean;
  installData: string;
  isAdmin: boolean;
}

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const defAppData: appData = {
  appDisplayName: "",
  appId: "",
  appShortcutName: "",
  authorId: "",
  description: "",
  displayImages: [],
  downloadUrls: [],
  install: {
    free: () => { },
    linux: undefined,
    win32: undefined,
    android: undefined,
  },
  repo: {
    free: () => { },
    author: "",
    repo: "",
  },
  version: "",
  verified: false,
  license_or_tos: "",
  releaseTagName: "",
  resources: {},
  site: "",
  source: "",
};

export default function ShowModal(props: AppDataPropsModal) {
  const { shown, dark, change, installData, isAdmin } = props;

  const {
    accessPrefs: { install_apps },
  } = (window as any).prefs as { accessPrefs: { install_apps: boolean } };

  const [appData, setAppData] = useState<appData>(defAppData);

  const [unsupported, setUnsupported] = useState(false);
  const [admin] = useState(false);

  const [resources, setResources] = useState<string[]>([pkg]);

  const button = useRef<HTMLButtonElement>("" as any);
  const [installed, setInstalled] = useState<boolean | "hidden">(false);
  const [updating, setUpdating] = useState(
    worker.update != "UpToDate" && worker.update != "Disabled",
  );
  const [author, setAuthor] = useState<AuthorObject>({
    avatar_url: "",
    free: () => { },
    github: "",
    id: "",
    name: "",
  });

  const progressBar = useRef<HTMLProgressElement>("" as any);

  useEffect(() => {
    const id = worker.listen((lib, update) => {
      console.log("Get");
      setUpdating(update != "UpToDate" && update != "Disabled");

      console.log(installData);
      const entry = lib.find((d) => d.app_id == installData);

      try {
        if (entry) {
          if (entry.to == "Uninstall") {
            button.current.innerHTML = entry.status;
            progressBar.current.hidden = false;
            progressBar.current.removeAttribute("value");

            if (entry.status == "Uninstalled" || entry.status == "Error") {
              progressBar.current.hidden = true;
              setTimeout(async () => {
                setInstalled(false);
              }, 1000);
            }
          } else {
            if (entry.status == "Downloading...") {
              button.current.innerHTML = `${entry.progress.toFixed(2)}% of ${formatBytes(
                entry.max,
              )}`;
              progressBar.current.hidden = false;
              progressBar.current.value = entry.progress;
            } else {
              button.current.innerHTML = entry.status;
              progressBar.current.hidden = false;
              progressBar.current.removeAttribute("value");

              if (entry.status == "Installed" || entry.status == "Error") {
                progressBar.current.hidden = true;
                setTimeout(async () => {
                  setInstalled(true);
                }, 1000);
              }
            }
          }
        }
      } catch (_) { }
    });

    return () => {
      console.log("Unlistening");
      worker.unlisten(id)
    };
  }, [installData]);

  useEffect(() => {
    setAppData(defAppData);
    setInstalled("hidden");
    (async () => {
      if ((installData || "") !== "") {
        const apps = await fetchApps(installData) as AHQStoreApplication;

        setAppData(apps as any);
        setInstalled(await isInstalled(installData));
        setAuthor(await fetchAuthor((apps as appData).authorId));

        setUnsupported(
          (() => {
            const install = apps.install;

            const arch = getArch();

            if (window.os.type == "windows") {
              // Windows
              switch (arch) {
                case "x86_64":
                  return install.win32 == undefined;
                case "aarch64":
                  return install.winarm == undefined;
                default:
                  return true;
              }
            } else {
              // Linux
              switch (arch) {
                case "x86_64":
                  return install.linux == undefined;
                case "aarch64":
                  return install.linuxArm64 == undefined;
                case "arm":
                  return install.linuxArm7 == undefined;
                default:
                  return true;
              }
            }
          })()
        );

        // TODO: Set Admin

        setUpdating(false);
      }
    })();
  }, [installData]);

  useEffect(() => {
    setResources([pkg]);

    const data = [];
    for (let i = 0; i <= appData.displayImages.length; i++) {
      data.push(getResource(appData.appId, `${i}`));
    }

    (async () => {
      setResources(await Promise.all(data));
    })();
  }, [appData, installData]);

  const {
    appDisplayName,
    description,
    authorId,
    source,
    displayImages,
    version,
    repo,
  } = appData;

  const install = async () => {
    button.current.innerHTML = "Starting Download...";

    await install_app(installData);
  };

  const uninstall = async () => {
    await unInstall(installData);
  };

  return (
    <ApplicationPopup shown={shown}>
      <div className="flex flex-col w-[100%] h-[100%]">
        <div className="flex w-[100%] h-[100%] app-data">
          <div
            className={`div w-[40%] p-2 flex flex-col items-center rounded-xl shadow-xl`}
          >
            <button
              onClick={() => {
                change();
              }}
              className={`rounded-md p-1 dui-btn dui-btn-outline dui-btn-square mr-auto`}
              style={{ transition: "all 250ms linear" }}
            >
              <BiArrowBack
                width="2em"
                height="2em"
                style={{
                  minWidth: "2em",
                  minHeight: "2em",
                }}
              />
            </button>
            {resources.length > 0 ? (
              <img
                src={resources[0]}
                alt="Logo"
                className="rounded-full shadow-2xl"
                style={{
                  width: "125px",
                  height: "125px",
                }}
              />
            ) : (
              <div
                  className={`dui-loading dui-loading-lg dui-loading-ring mt-5 mx-auto mb-[0.75rem] ${props.dark ? "text-white" : ""
                    }`}
              />
            )}

            <h1
              className={`mt-5 text-3xl text-center ${dark ? "text-slate-200" : "text-slate-800"
                }`}
            >
              {appDisplayName}
            </h1>

            <div className="w-[95%] mt-3 mb-auto">
              <h2
                className={`text-2xl text-center ${dark ? "text-gray-400" : "text-gray-600"
                  }`}
              >
                {description.length > 128 ? description.substring(0, 127) : description}
              </h2>
            </div>

            <progress
              ref={progressBar}
              className="dui-progress w-[60%] mb-2"
              value={0}
              max="100"
              hidden
            ></progress>

            <div
              role="alert"
              className={`dui-alert dui-alert-warning text-warning-content mb-2 ${!unsupported ? "hidden" : ""}`}
            >
              <IoWarning size={"1.5rem"} />
              <span>This app is not supported for this OS</span>
            </div>

            {isAdmin || install_apps ? (
              installed == "hidden" ? (
                <button
                  ref={button}
                  className="dui-btn btn-info w-[60%] mb-4"
                  style={{
                    backgroundColor: "transparent",
                    color: dark ? "white" : "black",
                    fontFamily: "inherit",
                    border: `2px ${dark ? "white" : "black"} solid`,
                  }}
                  disabled={true}
                >
                  <span className="dui-loading dui-loading-spinner"></span>
                  Loading
                </button>
              ) : installed ? (
                <button
                  ref={button}
                  className="dui-btn dui-btn-error w-[60%] mb-4"
                  style={{
                    color: "white",
                  }}
                  disabled={updating}
                  onClick={() => uninstall()}
                >
                  Uninstall {updating && <>(Updating)</>}
                </button>
              ) : (
                    <>
                  <button
                    ref={button}
                        className={`dui-btn ${updating
                        ? "bg-transparent hover:bg-transparent border-base-content hover:border-base-content text-base-content"
                        : "dui-btn-success text-success-content"
                          } w-[60%] mb-4`}
                    onClick={() => install()}
                  >
                    Install {updating && <>(Updating)</>}
                  </button>
                </>
              )
            ) : (
              <button className="dui-btn dui-btn-error text-white bg-red-700 hover:bg-red-700 border-red-700 hover:border-red-700 w-[60%] mb-4">
                No Permission
              </button>
            )}
          </div>

          <div
            className={`${dark ? "text-slate-200" : "text-slate-800"
              } div p-4 ml-2 w-[100%] rounded-xl shadow-xl flex flex-col overflow-scroll`}
          >
            <div className="w-full">
              <h1 className="text-xl">Description</h1>
              <Markdown>
                {description}
              </Markdown>
            </div>

            {/* Display Images */}
            <div
              className={`mt-3 w-[100%] ${displayImages.length == 0 ? "hidden" : ""}`}
            >
              <h1 className="text-xl">Images</h1>
              {resources.length < 2 ? (
                <div
                  className={`dui-loading dui-loading-lg dui-loading-ring mt-5 mx-auto mb-[0.75rem] ${props.dark ? "text-white" : ""}`}
                />
              ) : (
                <Carousel
                  opts={{
                    align: "start",
                  }}
                  orientation="horizontal"
                  className="w-[90%] mx-auto max-h-[400px]"
                >
                  <CarouselContent>
                    {displayImages.map((v) => (
                      <CarouselItem>
                        <img
                          src={resources[v + 1]}
                          className="mx-auto rounded-lg max-h-[350px]"
                        />
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious size="icon" />
                  <CarouselNext size="icon" />
                </Carousel>
              )}
            </div>

            {/* Author */}
            <div className="mt-3 w-[100%]">
              <h1 className="text-xl">About</h1>
              <button
                className="text-lg font-extralight flex items-center cursor-pointer text-blue-400"
                onClick={() => {
                  invoke("open", {
                    url: `https://ahqstore.github.io/user?${authorId}`,
                  });
                }}
              >
                {source ? (
                  <>
                    Destributed from {source} by {author.name}
                  </>
                ) : (
                  <>
                    Provided by{" "}
                    {authorId == "1" || authorId == "ahqsoftwares" ? (
                      <IoCheckmarkCircle className="ml-1" />
                    ) : (
                      <></>
                    )}
                    {author.name}
                  </>
                )}
              </button>
              <span className="block">
                <strong className="mr-2">Application id:</strong>
                {appData.appId}
              </span>
              <span className="block">
                <strong className="mr-2">Version:</strong>
                {(version || "").substring(0, 64)}
                {version.length > 64 && <>...</>}
              </span>
              <span className="block">
                <strong className="mr-2">Repository:</strong>
                <span
                  className="text-blue-400 cursor-pointer"
                  onClick={() =>
                    invoke("open", {
                      url: `https://github.com/${repo.author}/${repo.repo}`,
                    })
                  }
                >
                  {repo.author}/{repo.repo}
                </span>
              </span>
              <span className="flex">
                <strong className="mr-2">Supported Platforms:</strong>
                <span className="flex items-center space-x-2">
                  {(appData.install.win32 != undefined ||
                    appData.install.winarm != undefined) && (
                    <div
                      className="cursor-pointer flex text-center items-center justify-center border-[1px] border-base-content px-1"
                      onClick={() =>
                        invoke("open", {
                          url: "https://microsoft.com/windows",
                        })
                      }
                    >
                        <img src={win} width="20px" height="20px" />
                        <span className="ml-1">
                          Windows{" "}
                          {appData.install.win32 == undefined ? "arm64" : ""}
                        </span>
                      </div>
                    )}
                  {appData.install.linux != undefined && (
                    <div
                      className="cursor-pointer flex text-center items-center justify-center border-[1px] border-base-content px-1"
                      onClick={() =>
                        invoke("open", {
                          url: "https://en.wikipedia.org/wiki/Linux",
                        })
                      }
                    >
                      <FaLinux />
                      <span className="ml-1">Linux x64</span>
                    </div>
                  )}

                  {appData.install.linuxArm64 != undefined && (
                    <div
                      className="cursor-pointer flex text-center items-center justify-center border-[1px] border-base-content px-1"
                      onClick={() =>
                        invoke("open", {
                          url: "https://en.wikipedia.org/wiki/Linux",
                        })
                      }
                    >
                      <FaLinux />
                      <span className="ml-1">Linux arm64</span>
                    </div>
                  )}
                  {appData.install.linuxArm7 != undefined && (
                    <div
                      className="cursor-pointer flex text-center items-center justify-center border-[1px] border-base-content px-1"
                      onClick={() =>
                        invoke("open", {
                          url: "https://en.wikipedia.org/wiki/Linux",
                        })
                      }
                    >
                      <FaLinux />
                      <span className="ml-1">Linux armv7</span>
                    </div>
                  )}
                  {appData.install.android != undefined && (
                    <div
                      className="cursor-pointer flex text-center items-center justify-center border-[1px] border-base-content px-1"
                      onClick={() =>
                        invoke("open", {
                          url: "https://www.android.com/",
                        })
                      }
                    >
                      <FaAndroid />
                      <span className="ml-1">Android</span>
                    </div>
                  )}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </ApplicationPopup>
  );
}
