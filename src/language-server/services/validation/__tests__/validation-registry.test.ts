import { Disposable } from "vscode-languageclient";
import { services } from "../../../../testing";
import { LibraryPackage, Package } from "../../../generated/ast";
import { BaseValidationRegistry } from "../validation-registry";

describe("Validation registry", () => {
    let registry: BaseValidationRegistry;

    beforeEach(() => {
        registry = new BaseValidationRegistry(services.SysML);
    });

    describe("Custom validations", () => {
        let unregister: Disposable;
        beforeEach(() => {
            unregister = registry.registerValidationRule(Package, () => {
                /* empty */
            });
        });

        test("Custom checks are registered", () => {
            [Package, LibraryPackage].forEach((type) =>
                expect(registry.getChecks(type)).toHaveLength(1)
            );
        });

        test("Custom checks can be unregistered", () => {
            unregister.dispose();
            [Package, LibraryPackage].forEach((type) =>
                expect(registry.getChecks(type)).toHaveLength(0)
            );
        });
    });
});
