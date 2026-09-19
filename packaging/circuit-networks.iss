; Circuit Networks — offline desktop installer (Inno Setup 6)
; Compile with:  ISCC.exe packaging/circuit-networks.iss
; Requires: PyInstaller bundle built first at dist\CircuitNetworks\

#define MyAppName "Circuit Networks"
#define MyAppVersion "0.3.0"
#define MyAppPublisher "Circuit Networks"
#define MyAppExeName "CircuitNetworks.exe"

[Setup]
AppId={{4D90C6F1-4F21-4D0E-9B73-3A3780D6CA71}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Circuit Networks
DefaultGroupName=Circuit Networks
UninstallDisplayIcon={app}\{#MyAppExeName}
OutputDir=..\release
OutputBaseFilename=CircuitNetworks-Setup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\dist\CircuitNetworks\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Circuit Networks"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall Circuit Networks"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Circuit Networks"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,Circuit Networks}"; Flags: nowait postinstall skipifsilent