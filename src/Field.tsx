import * as PropTypes from 'prop-types';
import * as React from 'react';
import { getIn, isPromise } from './utils';

import { FormikProps } from './formik';
import { isFunction, isEmptyChildren } from './utils';
import warning from 'warning';

export type GenericFieldHTMLAttributes =
  | React.InputHTMLAttributes<HTMLInputElement>
  | React.SelectHTMLAttributes<HTMLSelectElement>
  | React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Note: These typings could be more restrictive, but then it would limit the
 * reusability of custom <Field/> components.
 *
 * @example
 * interface MyProps {
 *   ...
 * }
 *
 * export const MyInput: React.SFC<MyProps & FieldProps> = ({
 *   field,
 *   form,
 *   ...props
 * }) =>
 *   <div>
 *     <input {...field} {...props}/>
 *     {form.touched[field.name] && form.errors[field.name]}
 *   </div>
 */
export interface FieldProps<V = any> {
  field: {
    /** Classic React change handler, keyed by input name */
    onChange: (e: React.ChangeEvent<any>) => void;
    /** Mark input as touched */
    onBlur: (e: any) => void;
    /** Value of the input */
    value: any;
    /* name of the input */
    name: string;
  };
  form: FormikProps<V>; // if ppl want to restrict this for a given form, let them.
}

export interface FieldConfig {
  /**
   * Field component to render. Can either be a string like 'select' or a component.
   */
  component?:
    | string
    | React.ComponentType<FieldProps<any>>
    | React.ComponentType<void>;

  /**
   * Render prop (works like React router's <Route render={props =>} />)
   */
  render?: ((props: FieldProps<any>) => React.ReactNode);

  /**
   * Children render function <Field name>{props => ...}</Field>)
   */
  children?: ((props: FieldProps<any>) => React.ReactNode);

  /**
   * Validate a single field value independently
   */
  validate?: ((value: any) => string | Function | Promise<void> | undefined);

  /**
   * Field name
   */
  name: string;

  /** HTML input type */
  type?: string;

  /** Field value */
  value?: any;
}

export type FieldAttributes = GenericFieldHTMLAttributes & FieldConfig;

/**
 * Custom Field component for quickly hooking into Formik
 * context and wiring up forms.
 */

export class Field<Props extends FieldAttributes = any> extends React.Component<
  Props,
  {}
> {
  static contextTypes = {
    formik: PropTypes.object,
  };

  static propTypes = {
    name: PropTypes.string.isRequired,
    component: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
    render: PropTypes.func,
    children: PropTypes.oneOfType([PropTypes.func, PropTypes.node]),
    validate: PropTypes.func,
  };

  componentWillMount() {
    const { render, children, component } = this.props;

    warning(
      !(component && render),
      'You should not use <Field component> and <Field render> in the same <Field> component; <Field component> will be ignored'
    );

    warning(
      !(this.props.component && children && isFunction(children)),
      'You should not use <Field component> and <Field children> as a function in the same <Field> component; <Field component> will be ignored.'
    );

    warning(
      !(render && children && !isEmptyChildren(children)),
      'You should not use <Field render> and <Field children> in the same <Field> component; <Field children> will be ignored'
    );
  }

  handleChange = (e: React.ChangeEvent<any>) => {
    const { handleChange, validateOnChange } = this.context.formik;
    handleChange(e); // Call Formik's handleChange no matter what
    if (!!validateOnChange && !!this.props.validate) {
      this.runFieldValidations(e.target.value);
    }
  };

  handleBlur = (e: any) => {
    const { handleBlur, validateOnBlur } = this.context.formik;
    handleBlur(e); // Call Formik's handleBlur no matter what
    if (validateOnBlur && this.props.validate) {
      this.runFieldValidations(e.target.value);
    }
  };

  runFieldValidations = (value: any) => {
    const { setFieldError } = this.context.formik;
    const { name, validate } = this.props;
    // Call validate fn
    const maybePromise = (validate as any)(value);
    // Check if validate it returns a Promise
    if (isPromise(maybePromise)) {
      (maybePromise as Promise<any>).then(
        () => setFieldError(name, undefined),
        error => setFieldError(name, error)
      );
    } else {
      // Otherwise set the error
      setFieldError(name, maybePromise);
    }
  };

  render() {
    const {
      validate,
      name,
      render,
      children,
      component = 'input',
      ...props
    } = this.props as FieldConfig;

    const { formik } = this.context;
    const field = {
      value:
        props.type === 'radio' || props.type === 'checkbox'
          ? props.value // React uses checked={} for these inputs
          : getIn(formik.values, name),
      name,
      onChange: validate ? this.handleChange : formik.handleChange,
      onBlur: validate ? this.handleBlur : formik.handleBlur,
    };
    const bag = { field, form: formik };

    if (render) {
      return (render as any)(bag);
    }

    if (isFunction(children)) {
      return (children as (props: FieldProps<any>) => React.ReactNode)(bag);
    }

    if (typeof component === 'string') {
      return React.createElement(component as any, {
        ...field,
        ...props,
        children,
      });
    }

    return React.createElement(component as any, {
      ...bag,
      ...props,
      children,
    });
  }
}
