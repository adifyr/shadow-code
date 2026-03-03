import {Uri, window} from "vscode";
import {Logger} from "../utils/logger";
import {ILanguageHandler} from "./handler_interface";

type MavenSearchResult = {
  response: {
    docs: {
      g: string;
      a: string;
      latestVersion?: string;
    }[];
  };
};

export default class JavaHandler implements ILanguageHandler {
  readonly language: string = "Java";
  readonly configOptions: string[] = ["pom.xml", "build.gradle", "build.gradle.kts"];

  addMissingDependencies(configFileUri: Uri, config: string, output: string): void {
    const imports = this.extractImports(output);
    if (imports.length === 0) {
      return;
    }
    const existingDeps = this.extractExistingDependencies(config);
    const missing = imports.filter(imp => !existingDeps.has(imp));
    if (missing.length === 0) {
      return;
    }
    this.lookupAndNotify(missing, configFileUri);
  }

  private extractImports(output: string): string[] {
    const imports = new Set<string>();
    const matches = output.matchAll(/import\s+([a-zA-Z0-9_.]+)\s*;/g);
    for (const match of matches) {
      const fullPackage = match[1];
      const topLevel = fullPackage.split(".")[0];
      if (topLevel !== "java" && topLevel !== "javax") {
        imports.add(fullPackage);
      }
    }
    return Array.from(imports);
  }

  private extractExistingDependencies(config: string): Set<string> {
    const deps = new Set<string>();

    if (config.includes("<dependency>") || config.includes("<dependencies>")) {
      const groupMatches = config.matchAll(/<groupId>([^<]+)<\/groupId>/g);
      const artifactMatches = config.matchAll(/<artifactId>([^<]+)<\/artifactId>/g);

      const groups: string[] = [];
      for (const match of groupMatches) {
        groups.push(match[1]);
      }
      const artifacts: string[] = [];
      for (const match of artifactMatches) {
        artifacts.push(match[1]);
      }

      for (let i = 0; i < Math.min(groups.length, artifacts.length); i++) {
        deps.add(`${groups[i]}.${artifacts[i]}`);
      }
    }

    const gradleMatches = config.matchAll(/(?:implementation|api|compile)\s+['"]([^'"]+)['"]/g);
    for (const match of gradleMatches) {
      const dep = match[1];
      const parts = dep.split(":");
      if (parts.length >= 2) {
        deps.add(`${parts[0]}.${parts[1]}`);
      }
    }

    return deps;
  }

  private async lookupAndNotify(imports: string[], configFileUri: Uri | undefined): Promise<void> {
    const results: string[] = [];

    for (const imp of imports) {
      try {
        const response = await fetch(`https://search.maven.org/solrsearch/select?q=fc:${imp}&rows=1&wt=json`);
        if (!response.ok) {
          results.push(`${imp} (API lookup failed)`);
          continue;
        }

        const data = (await response.json()) as MavenSearchResult;
        if (data.response.docs.length > 0) {
          const doc = data.response.docs[0];
          const version = doc.latestVersion || "LATEST";
          results.push(`${doc.g}:${doc.a}:${version}`);
        } else {
          results.push(`${imp} (not found in Maven Central)`);
        }
      } catch (error) {
        Logger.error(`Maven Central lookup failed for ${imp}`, error);
        results.push(`${imp} (lookup error)`);
      }
    }

    if (results.length > 0) {
      const isPom = configFileUri?.fsPath.endsWith("pom.xml");
      const toolName = isPom ? "pom.xml" : "build.gradle";
      const message = `Add to ${toolName}:\n${results.join("\n")}`;

      window.showInformationMessage(`Shadow Code: ${results.length} dependencies may need to be added`, "View Details")
        .then((value) => {
          if (value === "View Details") {
            window.showInformationMessage(message);
          }
        });

      Logger.info(`Java dependencies to add to ${toolName}:\n${results.join("\n")}`);
    }
  }
}
